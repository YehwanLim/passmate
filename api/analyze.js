import { createHash } from "node:crypto";

import { getModelCallSequence, readAiModelSettings } from "../lib/ai-model-settings.js";
import {
  cancelAnalysisReservation,
  finalizeAnalysisReservation,
  reserveAnalysis,
} from "../lib/analysis-entitlements.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../lib/api-handler.js";
import { recordAuditEvent } from "../lib/audit-log.js";
import { requireActiveApplicationUser } from "../lib/auth.js";
import { consumeUserRateLimit, USER_RATE_LIMITS } from "../lib/rate-limit.js";
import prisma from "../lib/prisma.js";
import { MASTER_SYSTEM_PROMPT } from "../shared/prompts/reportPrompt.js";

const SETTINGS_ID = "singleton";
const FALLBACK_RETRY_DELAY_MS = 3000;
const MODEL_CALL_TIMEOUT_MS = 25000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

class ModelFailureError extends Error {
  constructor(code) {
    super(code);
    this.name = "ModelFailureError";
    this.code = code;
  }
}

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
  const timeout = setTimeout(() => controller.abort(), MODEL_CALL_TIMEOUT_MS);
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

function modelMetadata(value) {
  const meta = isRecord(value) ? value : {};
  const usage = isRecord(meta.tokenUsage) ? meta.tokenUsage : {};
  const number = (candidate) => Number.isFinite(Number(candidate)) ? Number(candidate) : null;
  return {
    modelName: typeof meta.modelName === "string" && meta.modelName.length > 0 ? meta.modelName : null,
    modelProvider: typeof meta.modelProvider === "string" && meta.modelProvider.length > 0 ? meta.modelProvider : null,
    responseTimeMs: number(meta.responseTimeMs),
    httpStatus: number(meta.httpStatus),
    tokenUsage: {
      promptTokens: number(usage.promptTokens) ?? 0,
      completionTokens: number(usage.completionTokens) ?? 0,
      totalTokens: number(usage.totalTokens) ?? 0,
    },
  };
}

function classifyFailure(error) {
  if (error?.name === "AbortError") return { code: "TIMEOUT", statusCode: 504 };
  if (error?.code === "PARSE_ERROR") return { code: "PARSE_ERROR", statusCode: 500 };
  if (error?.code === "CONTEXT_IRRELEVANT") return { code: "CONTEXT_IRRELEVANT", statusCode: 400 };
  return { code: "API_ERROR", statusCode: 500 };
}

function idempotencyResult(existing, hash) {
  if (!existing) return null;
  if (existing.requestHash !== hash) throw new ApiError("IDEMPOTENCY_KEY_REUSED", 409);
  if (existing.status === "PENDING" || existing.status === "CALLING") {
    throw new ApiError("ANALYSIS_IN_PROGRESS", 409);
  }
  if (existing.status === "FAILED") throw new ApiError("ANALYSIS_RETRY_WITH_NEW_KEY", 409);
  if (existing.status === "SUCCEEDED" && existing.analysis) {
    return {
      analysisId: existing.analysis.id,
      projectId: existing.analysis.projectId,
      report: existing.analysis.aiResponseJson,
    };
  }
  throw new ApiError("ANALYSIS_RETRY_WITH_NEW_KEY", 409);
}

const ANALYSIS_REQUEST_SELECT = {
  requestHash: true,
  status: true,
  expiresAt: true,
  id: true,
  reservationId: true,
  analysisId: true,
  idempotencyKey: true,
  providerMetadata: true,
  providerResult: true,
  analysis: { select: { id: true, projectId: true, aiResponseJson: true } },
};

function analysisResponse({ analysisId, projectId, report, requestId }) {
  return {
    analysis_id: analysisId,
    project_id: projectId,
    report,
    requestId,
  };
}

async function findExistingRequest(tx, userId, idempotencyKey) {
  return tx.analysisRequest.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    select: ANALYSIS_REQUEST_SELECT,
  });
}

async function findUnfinishedRequest(tx, userId, hash) {
  if (!tx.analysisRequest?.findFirst) return null;
  return tx.analysisRequest.findFirst({
    where: {
      userId,
      requestHash: hash,
      status: { in: ["PENDING", "CALLING", "PERSISTENCE_PENDING"] },
    },
    orderBy: { createdAt: "asc" },
    select: ANALYSIS_REQUEST_SELECT,
  });
}

function isExpiredPendingRequest(existing, now = new Date()) {
  // CALLING has crossed the external-provider boundary. Without a provider
  // result lookup API, releasing it automatically could buy a second model
  // invocation after an ambiguous provider success. Operators reconcile that
  // state through the protected admin route instead.
  if (existing?.status !== "PENDING" || !existing.expiresAt) return false;
  const expiry = new Date(existing.expiresAt);
  return Number.isFinite(expiry.getTime()) && expiry.getTime() <= now.getTime();
}

async function expirePendingRequest({ db, existing, requestId, userId }) {
  if (!isExpiredPendingRequest(existing)) return existing;

  return db.$transaction(async (tx) => {
    const current = await findExistingRequest(tx, userId, existing.idempotencyKey);
    if (!isExpiredPendingRequest(current)) return current;
    const now = new Date();
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: current.id, status: "PENDING", expiresAt: { lte: now } },
      data: { status: "FAILED" },
    });
    if (claimed.count !== 1) {
      return findExistingRequest(tx, userId, existing.idempotencyKey);
    }

    if (current.analysisId) {
      await tx.analysis.updateMany({
        where: { id: current.analysisId, status: "PENDING", userId },
        data: { status: "FAILED", errorCode: "API_ERROR", errorMessage: null },
      });
    }
    if (current.reservationId) {
      await tx.analysisReservation.updateMany({
        where: { id: current.reservationId, status: "PENDING", userId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }
    await recordAuditEvent({
      actorId: userId,
      db: tx,
      outcome: "EXPIRED",
      requestId,
      targetId: current.analysisId,
      targetType: "analysis",
    });

    return { ...current, status: "FAILED" };
  });
}

async function expireStaleRequestsForUser({ db, requestId, userId }) {
  if (!db.analysisRequest?.findMany) return;
  const expired = await db.analysisRequest.findMany({
    where: { userId, status: "PENDING", expiresAt: { lte: new Date() } },
    select: ANALYSIS_REQUEST_SELECT,
    take: 20,
  });

  for (const existing of expired) {
    await expirePendingRequest({ db, existing, requestId, userId });
  }
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
      },
    });
    return { type: "new", analysis, analysisRequest, project, reservation };
  });
}

async function beginProviderCall({ db, requestId }) {
  const claimed = await db.$transaction((tx) => tx.analysisRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "CALLING" },
  }));
  if (claimed.count !== 1) throw new ApiError("ANALYSIS_IN_PROGRESS", 409);
}

async function stageProviderResult({ db, metadata, report, requestId }) {
  const claimed = await db.$transaction((tx) => tx.analysisRequest.updateMany({
    where: { id: requestId, status: "CALLING" },
    data: {
      status: "PERSISTENCE_PENDING",
      providerMetadata: metadata,
      providerResult: report,
    },
  }));
  if (claimed.count !== 1) throw new ApiError("ANALYSIS_PERSISTENCE_PENDING", 409);
}

function allocationFromExisting(existing) {
  return {
    analysis: { id: existing.analysisId },
    analysisRequest: { id: existing.id },
    project: { id: existing.analysis?.projectId },
    reservation: { reservationId: existing.reservationId },
  };
}

async function recoverStagedRequest({ db, existing, finalize, userId }) {
  if (!existing.analysis || !isRecord(existing.providerResult) || !isRecord(existing.providerMetadata)) {
    return null;
  }
  try {
    await finalizeAnalysis({
      allocation: allocationFromExisting(existing),
      db,
      finalize,
      metadata: modelMetadata(existing.providerMetadata),
      report: existing.providerResult,
      userId,
    });
    return {
      analysisId: existing.analysis.id,
      projectId: existing.analysis.projectId,
      report: existing.providerResult,
    };
  } catch {
    return null;
  }
}

async function finalizeAnalysis({ db, allocation, finalize, metadata, report, userId }) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: allocation.analysisRequest.id, status: "PERSISTENCE_PENDING" },
      // The durable staging copy is needed only until this transaction commits;
      // keep the report solely on Analysis afterwards to minimise duplicate PII.
      data: { providerMetadata: null, providerResult: null, status: "SUCCEEDED" },
    });
    if (claimed.count !== 1) {
      throw new ModelFailureError("API_ERROR");
    }
    await tx.analysis.update({
      where: { id: allocation.analysis.id },
      data: {
        aiResponseJson: report,
        status: "SUCCESS",
        modelName: metadata.modelName,
        modelProvider: metadata.modelProvider,
        responseTime: metadata.responseTimeMs,
      },
    });
    if (metadata.modelName && metadata.modelProvider) {
      await tx.tokenUsage.create({
        data: {
          analysisId: allocation.analysis.id,
          modelName: metadata.modelName,
          modelProvider: metadata.modelProvider,
          promptTokens: metadata.tokenUsage.promptTokens,
          completionTokens: metadata.tokenUsage.completionTokens,
          totalTokens: metadata.tokenUsage.totalTokens,
          cost: null,
          costCurrency: "USD",
          callType: "ANALYSIS",
          latencyMs: metadata.responseTimeMs,
          httpStatus: metadata.httpStatus,
          isSuccess: true,
        },
      });
    }
    await finalize(tx, allocation.reservation.reservationId, userId);
  });
}

async function failAnalysis({ allocation, cancel, db, failure, requestId, userId }) {
  await db.$transaction(async (tx) => {
    const claimed = await tx.analysisRequest.updateMany({
      where: { id: allocation.analysisRequest.id, status: "CALLING" },
      data: { status: "FAILED" },
    });
    if (claimed.count !== 1) return false;
    await tx.analysis.updateMany({
      where: { id: allocation.analysis.id, status: "PENDING", userId },
      data: { status: "FAILED", errorCode: failure.code, errorMessage: null },
    });
    await cancel(tx, allocation.reservation.reservationId, userId);
    await recordAuditEvent({
      actorId: userId,
      db: tx,
      outcome: failure.code,
      requestId,
      targetId: allocation.analysis.id,
      targetType: "analysis",
    });
    return true;
  });
}

export function createAnalyzeHandler({
  cancelReservation = cancelAnalysisReservation,
  consumeRateLimit = consumeUserRateLimit,
  db = prisma,
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
          ? sendJson(res, 200, analysisResponse({ ...recovered, requestId }), requestId)
          : sendError(res, 503, "ANALYSIS_PERSISTENCE_PENDING", requestId);
      }
      const stored = idempotencyResult(existing, hash);
      if (stored) {
        return sendJson(res, 200, analysisResponse({ ...stored, requestId }), requestId);
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
          ? sendJson(res, 200, analysisResponse({ ...recovered, requestId }), requestId)
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
        if (error?.code !== "P2002") throw error;
        const existing = await findExistingRequest(db, applicationUser.id, idempotencyKey);
        const stored = idempotencyResult(existing, hash);
        if (stored) {
          return sendJson(res, 200, analysisResponse({ ...stored, requestId }), requestId);
        }
        throw new ApiError("ANALYSIS_IN_PROGRESS", 409);
      }

      if (allocation.type === "stored") {
        return sendJson(res, 200, analysisResponse({
          analysisId: allocation.analysisId,
          projectId: allocation.projectId,
          report: allocation.report,
          requestId,
        }), requestId);
      }

      let providerCompleted = false;
      try {
        await beginProviderCall({ db, requestId: allocation.analysisRequest.id });
        const modelResult = await model(request, db);
        if (!isRecord(modelResult)) throw new ModelFailureError("PARSE_ERROR");
        if (modelResult.error === "CONTEXT_IRRELEVANT") {
          throw new ModelFailureError("CONTEXT_IRRELEVANT");
        }
        const { analysisMeta, ...report } = modelResult;
        const metadata = modelMetadata(analysisMeta);
        providerCompleted = true;
        await stageProviderResult({
          db,
          metadata,
          report,
          requestId: allocation.analysisRequest.id,
        });
        await finalizeAnalysis({
          allocation,
          db,
          finalize: finalizeReservation,
          metadata,
          report,
          userId: applicationUser.id,
        });
        return sendJson(res, 200, analysisResponse({
          analysisId: allocation.analysis.id,
          projectId: allocation.project.id,
          report,
          requestId,
        }), requestId);
      } catch (error) {
        if (providerCompleted) {
          // The provider result is durably staged (or the request remains in
          // CALLING if the database was unavailable). Never refund this
          // reservation based on an ambiguous post-provider failure; the same
          // idempotency key is the recovery handle.
          return sendError(res, 503, "ANALYSIS_PERSISTENCE_PENDING", requestId);
        }
        const failure = classifyFailure(error);
        try {
          await failAnalysis({
            allocation,
            cancel: cancelReservation,
            db,
            failure,
            requestId,
            userId: applicationUser.id,
          });
        } catch {
          // The original model failure remains the only client-visible state.
        }
        return sendError(res, failure.statusCode, failure.code === "CONTEXT_IRRELEVANT" ? failure.code : "ANALYSIS_FAILED", requestId);
      }
    });
  };
}

export const maxDuration = 60;

export default createAnalyzeHandler();
