import { createHash } from "node:crypto";
import { waitUntil } from "@vercel/functions";

import { getModelCallSequence, readAiModelSettings } from "../lib/ai-model-settings.js";
import {
  cancelAnalysisReservation,
  EntitlementUnavailableError,
  finalizeAnalysisReservation,
  reserveAnalysis,
} from "../lib/analysis-entitlements.js";
import {
  ANALYSIS_MODEL_TIMEOUT_MS,
  ANALYSIS_REQUEST_SELECT,
  ANALYSIS_REQUEST_TTL_MS,
  AnalysisModelFailureError as ModelFailureError,
  analysisReceipt,
  expirePendingRequest,
  expireStaleRequestsForUser,
  failUnstartedAnalysis,
  findExistingRequest,
  findUnfinishedRequest,
  idempotencyResult,
  recoverStagedRequest,
  runAllocatedAnalysis,
} from "../lib/analysis-request-lifecycle.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../lib/api-handler.js";
import { requireActiveApplicationUser } from "../lib/auth.js";
import { consumeUserRateLimit, USER_RATE_LIMITS } from "../lib/rate-limit.js";
import prisma from "../lib/prisma.js";
import { MASTER_SYSTEM_PROMPT } from "../shared/prompts/reportPrompt.js";

const SETTINGS_ID = "singleton";
const FALLBACK_RETRY_DELAY_MS = 3000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function sanitizeInput(value) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|form|input|button|link|meta)\b[^>]*>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:[^,]*,/gi, "")
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
    .trim();
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getHeader(req, name) {
  return req.headers?.[name] ?? req.headers?.[name.toLowerCase()] ?? req.headers?.[name.toUpperCase()];
}

function getIdempotencyKey(req) {
  const key = getHeader(req, "Idempotency-Key");
  return typeof key === "string" && IDEMPOTENCY_KEY_PATTERN.test(key) ? key : null;
}

function normalizeRequest(body) {
  if (!isRecord(body)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const allowedKeys = new Set(["company", "jobKeyword", "questions"]);
  if (!Object.keys(body).every((key) => allowedKeys.has(key)) || !Array.isArray(body.questions)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  if (body.company !== undefined && typeof body.company !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.jobKeyword !== undefined && typeof body.jobKeyword !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.questions.length === 0 || body.questions.length > 20) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const questions = body.questions.map((question) => {
    if (!isRecord(question) || typeof question.question !== "string" || typeof question.answer !== "string") {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    if (!Object.keys(question).every((key) => key === "question" || key === "answer")) {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    return { question: sanitizeInput(question.question), answer: sanitizeInput(question.answer) };
  });

  const totalChars = questions.reduce((total, question) => total + question.answer.length, 0);
  if (totalChars < 200) {
    throw new ApiError("CHAR_MINIMUM", 400);
  }
  if (totalChars > 6000) {
    throw new ApiError("CHAR_OVER_LIMIT", 400);
  }
  if (!questions.some((question) => question.answer.length > 0)) {
    throw new ApiError("EMPTY_CONTENT", 400);
  }

  return {
    company: sanitizeInput(body.company),
    jobKeyword: sanitizeInput(body.jobKeyword),
    questions,
    totalChars,
  };
}

function requestHash(request) {
  return createHash("sha256")
    .update(JSON.stringify({
      company: request.company,
      jobKeyword: request.jobKeyword,
      questions: request.questions,
    }))
    .digest("hex");
}

function buildProjectTitle(company, jobKeyword) {
  const safeCompany = company || "기업 미지정";
  return jobKeyword ? `${safeCompany} ${jobKeyword} 지원서` : `${safeCompany} 지원서`;
}

function createQuestionText(questions) {
  return questions
    .map((question, index) => `[문항 ${index + 1}] ${question.question || `문항 ${index + 1}`}`)
    .join("\n\n");
}

function createInputText(questions) {
  return questions
    .map((question, index) => `[문항 ${index + 1}]\n${question.answer}`)
    .join("\n\n");
}

function buildUserPrompt(request) {
  let prompt = "";
  if (request.company) prompt += `[지원 기업]: ${request.company}\n`;
  if (request.jobKeyword) prompt += `[지원 직무]: ${request.jobKeyword}\n`;
  prompt += `[문항 수]: ${request.questions.length}\n\n`;
  request.questions.forEach((question, index) => {
    prompt += `--- 문항 ${index + 1} ---\n[질문]: ${question.question || `문항 ${index + 1}`}\n[답변]:\n${question.answer}\n\n`;
  });
  return `${prompt}위 자기소개서를 분석하고 JSON 형식으로 응답하세요. 반드시 한국어로 작성하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.`;
}

export function attachRequestAnswers(report, questions) {
  if (!isRecord(report) || !Array.isArray(report.questionTabs)) {
    return report;
  }

  return {
    ...report,
    questionTabs: report.questionTabs.map((tab, index) => {
      const question = questions[index];
      if (!isRecord(tab) || !question) return tab;
      return {
        ...tab,
        prompt: question.question || `문항 ${index + 1}`,
        fullAnswer: question.answer,
      };
    }),
  };
}

function parseModelJson(rawText) {
  const text = String(rawText ?? "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new ModelFailureError("PARSE_ERROR");
  }
}

function getAnalyzeApiErrorResponse(error) {
  if (error?.name === "AbortError") {
    return {
      status: 504,
      body: { error: "TIMEOUT", message: "분석 시간이 초과되었습니다. 다시 시도해 주세요." },
    };
  }

  if (error?.statusCode === 503) {
    return {
      status: 503,
      body: {
        error: "MODEL_OVERLOADED",
        message: "AI 모델 사용량이 잠시 몰렸어요. 작성하신 내용은 안전하게 보관 중이니 잠시 후 다시 시도해 주세요.",
      },
    };
  }

  return { status: 500, body: { error: "ANALYSIS_FAILED" } };
}

export { getAnalyzeApiErrorResponse };

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYSIS_MODEL_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, responseTimeMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiOnce(prompt, apiKey, modelName) {
  const { response, responseTimeMs } = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: `${MASTER_SYSTEM_PROMPT}\n\n${prompt}` }] }] }),
    },
  );
  if (!response.ok) {
    const error = new Error("Model request failed");
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new ModelFailureError("PARSE_ERROR");
  const usage = data.usageMetadata ?? {};
  return {
    parsed: parseModelJson(rawText),
    responseTimeMs,
    httpStatus: response.status,
    tokenUsage: {
      promptTokens: Number(usage.promptTokenCount ?? 0),
      completionTokens: Number(usage.candidatesTokenCount ?? 0),
      totalTokens: Number(usage.totalTokenCount ?? 0),
    },
  };
}

async function callOpenAiOnce(prompt, apiKey, modelName) {
  const { response, responseTimeMs } = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, input: `${MASTER_SYSTEM_PROMPT}\n\n${prompt}` }),
  });
  if (!response.ok) {
    const error = new Error("Model request failed");
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  const rawText = typeof data.output_text === "string"
    ? data.output_text
    : (data.output ?? []).flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("");
  if (!rawText) throw new ModelFailureError("PARSE_ERROR");
  const usage = data.usage ?? {};
  return {
    parsed: parseModelJson(rawText),
    responseTimeMs,
    httpStatus: response.status,
    tokenUsage: {
      promptTokens: Number(usage.input_tokens ?? 0),
      completionTokens: Number(usage.output_tokens ?? 0),
      totalTokens: Number(usage.total_tokens ?? 0),
    },
  };
}

async function analyzeCoverLetter(request, db = prisma) {
  const prompt = buildUserPrompt(request);
  const candidates = getModelCallSequence(await readAiModelSettings(db));
  let lastError;

  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const activeModel = candidates[attempt];
    const apiKey = activeModel.providerKey === "openai"
      ? process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY
      : process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ModelFailureError("API_ERROR");
    }

    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, FALLBACK_RETRY_DELAY_MS));
      }
      const result = activeModel.providerKey === "openai"
        ? await callOpenAiOnce(prompt, apiKey, activeModel.modelName)
        : await callGeminiOnce(prompt, apiKey, activeModel.modelName);
      return {
        ...attachRequestAnswers(result.parsed, request.questions),
        analysisMeta: {
          modelProvider: activeModel.providerKey,
          modelName: activeModel.modelName,
          responseTimeMs: result.responseTimeMs,
          httpStatus: result.httpStatus,
          tokenUsage: result.tokenUsage,
        },
      };
    } catch (error) {
      lastError = error;
      if (error?.name === "AbortError" || ![429, 500, 503].includes(error?.statusCode)) {
        break;
      }
    }
  }

  throw lastError ?? new ModelFailureError("API_ERROR");
}

async function allocateAnalysisRequest({ db, hash, idempotencyKey, request, reserve, userId }) {
  return db.$transaction(async (tx) => {
    const existing = await findExistingRequest(tx, userId, idempotencyKey);
    const reused = idempotencyResult(existing, hash);
    if (reused) return { type: "stored", ...reused };

    const reservation = await reserve(tx, userId);
    const project = await tx.project.create({
      data: {
        userId,
        title: buildProjectTitle(request.company, request.jobKeyword),
        company: request.company || null,
        jobKeyword: request.jobKeyword || null,
      },
    });
    const analysis = await tx.analysis.create({
      data: {
        userId,
        projectId: project.id,
        questionText: createQuestionText(request.questions),
        inputText: createInputText(request.questions),
        totalChars: request.totalChars,
        status: "PENDING",
      },
    });
    const analysisRequest = await tx.analysisRequest.create({
      data: {
        userId,
        idempotencyKey,
        requestHash: hash,
        reservationId: reservation.reservationId,
        analysisId: analysis.id,
        expiresAt: new Date(Date.now() + ANALYSIS_REQUEST_TTL_MS),
      },
    });
    return { type: "new", analysis, analysisRequest, project, reservation };
  });
}

export function createAnalyzeHandler({
  cancelReservation = cancelAnalysisReservation,
  consumeRateLimit = consumeUserRateLimit,
  db = prisma,
  enqueueBackgroundWork = (work) => waitUntil(work()),
  finalizeReservation = finalizeAnalysisReservation,
  model = analyzeCoverLetter,
  requireUser = requireActiveApplicationUser,
  reserveAnalysis: reserve = reserveAnalysis,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const { applicationUser } = await requireUser(req, db);
      const idempotencyKey = getIdempotencyKey(req);
      if (!idempotencyKey) {
        throw new ApiError("INVALID_IDEMPOTENCY_KEY", 400);
      }
      const request = normalizeRequest(req.body);
      const hash = requestHash(request);

      // A completed request is a read-only replay: do not consume another rate
      // limit slot or allow a kill switch change to hide the original result.
      await expireStaleRequestsForUser({ db, requestId, userId: applicationUser.id });
      let existing = await findExistingRequest(db, applicationUser.id, idempotencyKey);
      existing = await expirePendingRequest({
        db,
        existing,
        requestId,
        userId: applicationUser.id,
      });
      if (existing && existing.requestHash !== hash) {
        throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
      }
      if (existing?.status === "PERSISTENCE_PENDING") {
        const recovered = await recoverStagedRequest({
          db,
          existing,
          finalize: finalizeReservation,
          userId: applicationUser.id,
        });
        return recovered
          ? sendJson(res, 200, analysisReceipt({
            analysisId: recovered.analysisId,
            analysisRequestId: existing.id,
            projectId: recovered.projectId,
            requestId,
            status: "SUCCEEDED",
          }), requestId)
          : sendError(res, 503, "ANALYSIS_PERSISTENCE_PENDING", requestId);
      }
      const stored = idempotencyResult(existing, hash);
      if (stored) {
        return sendJson(res, stored.status === "SUCCEEDED" ? 200 : 202, analysisReceipt({
          ...stored,
          requestId,
        }), requestId);
      }

      // A refresh loses the client-held idempotency key. Find unfinished work
      // by its server-side request hash before reserving another credit.
      const unfinished = await findUnfinishedRequest(db, applicationUser.id, hash);
      if (unfinished?.status === "PERSISTENCE_PENDING") {
        const recovered = await recoverStagedRequest({
          db,
          existing: unfinished,
          finalize: finalizeReservation,
          userId: applicationUser.id,
        });
        return recovered
          ? sendJson(res, 200, analysisReceipt({
            analysisId: recovered.analysisId,
            analysisRequestId: unfinished.id,
            projectId: recovered.projectId,
            requestId,
            status: "SUCCEEDED",
          }), requestId)
          : sendError(res, 503, "ANALYSIS_PERSISTENCE_PENDING", requestId);
      }
      if (unfinished) return sendError(res, 409, "ANALYSIS_IN_PROGRESS", requestId);

      const rate = await consumeRateLimit(db, {
        userId: applicationUser.id,
        policy: USER_RATE_LIMITS.analysis,
      });
      if (!rate.allowed) {
        res.setHeader?.("Retry-After", String(rate.retryAfterSeconds));
        return sendError(res, 429, "RATE_LIMITED", requestId);
      }

      const settings = await db.entitlementSetting.findUnique({
        where: { id: SETTINGS_ID },
        select: { analysisEnabled: true },
      });
      if (!settings?.analysisEnabled) {
        return sendError(res, 503, "ANALYSIS_DISABLED", requestId);
      }

      let allocation;
      try {
        allocation = await allocateAnalysisRequest({
          db,
          hash,
          idempotencyKey,
          request,
          reserve,
          userId: applicationUser.id,
        });
      } catch (error) {
        if (error instanceof EntitlementUnavailableError) {
          throw new ApiError("ANALYSIS_CREDITS_EXHAUSTED", 409);
        }
        if (error?.code !== "P2002") throw error;
        const existing = await findExistingRequest(db, applicationUser.id, idempotencyKey);
        const stored = idempotencyResult(existing, hash);
        if (stored) {
          return sendJson(res, stored.status === "SUCCEEDED" ? 200 : 202, analysisReceipt({
            ...stored,
            requestId,
          }), requestId);
        }
        throw new ApiError("ANALYSIS_IN_PROGRESS", 409);
      }

      if (allocation.type === "stored") {
        return sendJson(res, allocation.status === "SUCCEEDED" ? 200 : 202, analysisReceipt({
          analysisId: allocation.analysisId,
          analysisRequestId: allocation.analysisRequestId,
          projectId: allocation.projectId,
          requestId,
          status: allocation.status,
        }), requestId);
      }

      try {
        enqueueBackgroundWork(() => runAllocatedAnalysis({
          allocation,
          cancel: cancelReservation,
          db,
          finalize: finalizeReservation,
          model,
          request,
          requestId,
          userId: applicationUser.id,
        }));
      } catch {
        await failUnstartedAnalysis({
          allocation,
          cancel: cancelReservation,
          db,
          requestId,
          userId: applicationUser.id,
        });
        return sendError(res, 503, "ANALYSIS_FAILED", requestId);
      }

      return sendJson(res, 202, analysisReceipt({
        analysisId: allocation.analysis.id,
        analysisRequestId: allocation.analysisRequest.id,
        projectId: allocation.project.id,
        requestId,
        status: "PENDING",
      }), requestId);
    });
  };
}

export const maxDuration = 120;

export default createAnalyzeHandler();
