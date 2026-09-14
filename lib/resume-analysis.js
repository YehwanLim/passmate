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
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 프롬프트에 넣는 공고 원문 상한. 저장은 6,000자까지 하지만 요약이 핵심을 이미 담고 있고,
// 입력이 길어질수록 2.5-flash 응답이 타임아웃에 가까워져(09-15 실측) 원문은 앞부분만 준다.
export const PROMPT_POSTING_TEXT_CHARS = 1500;

/**
 * POST /api/analyze 본문. 클라이언트 MAX_QUESTIONS(5)와 동일한 상한. 문항 질문·기업·직무 텍스트도
 * 프롬프트에 그대로 들어가므로 길이를 제한해 비용 부풀리기를 막는다.
 */
export function normalizeRequest(body) {
  if (!isRecord(body)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const allowedKeys = new Set(["company", "jobKeyword", "questions", "jobPostingId"]);
  if (!Object.keys(body).every((key) => allowedKeys.has(key)) || !Array.isArray(body.questions)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  if (body.company !== undefined && typeof body.company !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.jobKeyword !== undefined && typeof body.jobKeyword !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  // 채용공고는 POST /api/analyze/posting 이 먼저 만든 행의 id 로만 받는다(선택).
  if (body.jobPostingId !== undefined && body.jobPostingId !== null
    && (typeof body.jobPostingId !== "string" || !UUID_PATTERN.test(body.jobPostingId))) {
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
    jobPostingId: body.jobPostingId ?? null,
  };
}

export function requestHash(request) {
  const fingerprint = {
    company: request.company,
    jobKeyword: request.jobKeyword,
    questions: request.questions,
  };
  // 공고 없는 요청의 해시는 이전과 같게 유지한다(진행 중 요청 재발견·멱등 재생 호환).
  if (request.jobPostingId) fingerprint.jobPostingId = request.jobPostingId;
  return createHash("sha256")
    .update(JSON.stringify(fingerprint))
    .digest("hex");
}

/**
 * 연결한 채용공고의 소유권을 확인하고 프롬프트용 본문·요약을 request 에 붙인다.
 * 해시는 이 함수 전에 계산되므로 부착이 멱등성에 영향을 주지 않는다. 남의 공고나 없는 id 는 404.
 */
export async function verifyResumeRequest(request, { db, userId }) {
  if (!request.jobPostingId) return;
  const posting = await db.jobPosting.findFirst({
    where: { id: request.jobPostingId, userId },
    select: { id: true, sourceUrl: true, rawText: true, summaryJson: true },
  });
  if (!posting) {
    throw new ApiError("NOT_FOUND", 404);
  }
  request.jobPosting = posting;
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
    jobPostingId: request.jobPostingId ?? null,
  };
}

function formatSummaryList(label, items) {
  return Array.isArray(items) && items.length > 0 ? `- ${label}: ${items.join(" / ")}\n` : "";
}

/** verifyResumeRequest 가 붙인 채용공고를 요약 → 원문 순으로 프롬프트 블록으로 만든다. */
function buildJobPostingBlock(posting) {
  const summary = isRecord(posting?.summaryJson) ? posting.summaryJson : {};
  let block = "[채용공고 요약]\n";
  const identity = [summary.company, summary.role || summary.title].filter((value) => typeof value === "string" && value).join(" · ");
  if (identity) block += `- 공고: ${identity}\n`;
  block += formatSummaryList("수행 업무", summary.responsibilities);
  block += formatSummaryList("자격요건", summary.requirements);
  block += formatSummaryList("우대사항", summary.preferred);
  block += formatSummaryList("핵심 키워드", summary.keywords);
  if (typeof posting?.rawText === "string" && posting.rawText) {
    const excerpt = posting.rawText.slice(0, PROMPT_POSTING_TEXT_CHARS);
    const truncated = excerpt.length < posting.rawText.length ? " (이하 생략)" : "";
    block += `[채용공고 원문${truncated ? " 발췌" : ""}]\n${excerpt}${truncated}\n`;
  }
  return `${block}\n`;
}

export function buildUserPrompt(request) {
  let prompt = "";
  if (request.company) prompt += `[지원 기업]: ${request.company}\n`;
  if (request.jobKeyword) prompt += `[지원 직무]: ${request.jobKeyword}\n`;
  const hasPosting = Boolean(request.jobPosting);
  if (hasPosting) prompt += buildJobPostingBlock(request.jobPosting);
  prompt += `[문항 수]: ${request.questions.length}\n\n`;
  request.questions.forEach((question, index) => {
    prompt += `--- 문항 ${index + 1} ---\n[질문]: ${question.question || `문항 ${index + 1}`}\n[답변]:\n${question.answer}\n\n`;
  });
  const postingDirective = hasPosting
    ? " 채용공고가 주어졌으므로 postingFit 을 채우고, 합격 기준·보완점·문항 피드백은 공고의 자격요건·우대사항을 기준으로 판단하세요."
    : " 채용공고가 없으므로 postingFit 은 null 로 두세요.";
  return `${prompt}위 자기소개서를 분석하고 JSON 형식으로 응답하세요.${postingDirective} 반드시 한국어로 작성하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.`;
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
