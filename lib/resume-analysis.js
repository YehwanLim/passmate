import { createHash } from "node:crypto";

import { getModelCallSequence, readAiModelSettings } from "./ai-model-settings.js";
import { ANALYSIS_MODEL_TIMEOUT_MS, AnalysisModelFailureError } from "./analysis-request-lifecycle.js";
import { ApiError } from "./api-handler.js";
import {
  callGeminiGenerate,
  fetchWithTimeout,
  firstCandidateText,
  geminiUsage,
  modelRequestError,
  openAiUsage,
  parseModelJson,
} from "./model-client.js";
import prisma from "./prisma.js";
import { isRecord, sanitizeInput } from "./sanitize.js";
import { MASTER_SYSTEM_PROMPT } from "../shared/prompts/reportPrompt.js";

// 자소서 분석 파이프라인: 요청 검증 → 프롬프트 → 모델 호출(폴백 포함). 기업 분석은 company-analysis.js.

const FALLBACK_RETRY_DELAY_MS = 3000;

/**
 * POST /api/analyze 본문. 클라이언트 MAX_QUESTIONS(5)와 동일한 상한. 문항 질문·기업·직무 텍스트도
 * 프롬프트에 그대로 들어가므로 길이를 제한해 비용 부풀리기를 막는다.
 */
export function normalizeRequest(body) {
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
  if (body.questions.length === 0 || body.questions.length > 5) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.company !== undefined && body.company.length > 100) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.jobKeyword !== undefined && body.jobKeyword.length > 100) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const questions = body.questions.map((question) => {
    if (!isRecord(question) || typeof question.question !== "string" || typeof question.answer !== "string") {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    if (!Object.keys(question).every((key) => key === "question" || key === "answer")) {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    if (question.question.length > 300) {
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

export function requestHash(request) {
  return createHash("sha256")
    .update(JSON.stringify({
      company: request.company,
      jobKeyword: request.jobKeyword,
      questions: request.questions,
    }))
    .digest("hex");
}

export function buildProjectTitle(company, jobKeyword) {
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

/** 자소서 분석의 Analysis 입력 컬럼. 기업 분석은 companyAnalysisInput 을 대신 쓴다. */
export function resumeAnalysisInput(request) {
  return {
    questionText: createQuestionText(request.questions),
    inputText: createInputText(request.questions),
    totalChars: request.totalChars,
  };
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

async function callGeminiOnce(prompt, apiKey, modelName) {
  const { data, responseTimeMs, httpStatus } = await callGeminiGenerate({
    apiKey,
    modelName,
    timeoutMs: ANALYSIS_MODEL_TIMEOUT_MS,
    body: {
      contents: [{ role: "user", parts: [{ text: `${MASTER_SYSTEM_PROMPT}\n\n${prompt}` }] }],
      // JSON 출력을 API 수준에서 강제한다. 프롬프트 지시만으로는 코드펜스 등 잡음이 섞일 수 있다.
      generationConfig: { responseMimeType: "application/json" },
    },
  });
  const rawText = firstCandidateText(data);
  if (!rawText) throw new AnalysisModelFailureError("PARSE_ERROR");
  return {
    parsed: parseModelJson(rawText),
    responseTimeMs,
    httpStatus,
    tokenUsage: geminiUsage(data),
  };
}

async function callOpenAiOnce(prompt, apiKey, modelName) {
  const { response, responseTimeMs } = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelName, input: `${MASTER_SYSTEM_PROMPT}\n\n${prompt}` }),
  }, ANALYSIS_MODEL_TIMEOUT_MS);
  if (!response.ok) throw modelRequestError(response);
  const data = await response.json();
  const rawText = typeof data.output_text === "string"
    ? data.output_text
    : (data.output ?? []).flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("");
  if (!rawText) throw new AnalysisModelFailureError("PARSE_ERROR");
  return {
    parsed: parseModelJson(rawText),
    responseTimeMs,
    httpStatus: response.status,
    tokenUsage: openAiUsage(data),
  };
}

/** 설정된 모델 순서대로 호출하고, 429/500/503 이면 다음 후보로 넘어간다. */
export async function analyzeCoverLetter(request, db = prisma) {
  const prompt = buildUserPrompt(request);
  const candidates = getModelCallSequence(await readAiModelSettings(db));
  let lastError;

  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const activeModel = candidates[attempt];
    const apiKey = activeModel.providerKey === "openai"
      ? process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY
      : process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AnalysisModelFailureError("API_ERROR");
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

  throw lastError ?? new AnalysisModelFailureError("API_ERROR");
}
