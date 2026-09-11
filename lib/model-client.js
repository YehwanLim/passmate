import { AnalysisModelFailureError } from "./analysis-request-lifecycle.js";

// Gemini / OpenAI 호출의 공통 조각. 자소서 분석·기업 분석·문항 분리가 같은 fetch 셸을 쓴다.
// 타임아웃 값은 호출자가 넘긴다(모델 100s < TTL 125s < maxDuration 120s, CLAUDE.md 함정 4).

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/** 남은 데드라인과 단계 상한 중 짧은 쪽으로 fetch 를 끊는다. 예산이 없으면 AbortError 로 바로 던진다. */
export async function fetchWithDeadline(fetcher, url, options, { deadlineAt, now, maxMs }) {
  const remaining = deadlineAt - now();
  const budget = Math.min(remaining, maxMs);
  if (budget <= 0) {
    const error = new Error("Model deadline exceeded");
    error.name = "AbortError";
    throw error;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), budget);
  const startedAt = now();
  try {
    const response = await fetcher(url, { ...options, signal: controller.signal });
    return { response, responseTimeMs: now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

/** 단일 타임아웃 fetch. fetchWithDeadline 의 얇은 껍데기. */
export function fetchWithTimeout(url, options, timeoutMs, { fetcher = globalThis.fetch, now = Date.now } = {}) {
  return fetchWithDeadline(fetcher, url, options, { deadlineAt: now() + timeoutMs, now, maxMs: timeoutMs });
}

/** 제공자 HTTP 실패. statusCode 로 429/500/503 재시도 판단을 한다. */
export function modelRequestError(response) {
  const error = new Error("Model request failed");
  error.statusCode = response.status;
  return error;
}

/**
 * Gemini generateContent 한 번. body 는 호출자가 그대로 넘긴다(검색 도구·thinking 예산 포함).
 * deadline 또는 timeoutMs 중 하나를 준다.
 */
export async function callGeminiGenerate({ apiKey, modelName, body, fetcher = globalThis.fetch, now = Date.now, deadline, timeoutMs }) {
  const budget = deadline ?? { deadlineAt: now() + timeoutMs, now, maxMs: timeoutMs };
  const { response, responseTimeMs } = await fetchWithDeadline(
    fetcher,
    `${GEMINI_BASE_URL}/${modelName}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    budget,
  );
  if (!response.ok) throw modelRequestError(response);
  const data = await response.json();
  return { data, responseTimeMs, httpStatus: response.status };
}

/** 첫 후보의 첫 텍스트 파트. JSON 모드 응답은 파트가 하나다. */
export function firstCandidateText(data) {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : "";
}

/** grounded 응답은 parts 가 여러 개로 나뉘어 온다. 텍스트 파트를 모두 이어 붙인다. */
export function joinCandidateText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
}

export function geminiUsage(data) {
  const usage = data?.usageMetadata ?? {};
  return {
    promptTokens: Number(usage.promptTokenCount ?? 0),
    completionTokens: Number(usage.candidatesTokenCount ?? 0),
    totalTokens: Number(usage.totalTokenCount ?? 0),
  };
}

export function openAiUsage(data) {
  const usage = data?.usage ?? {};
  return {
    promptTokens: Number(usage.input_tokens ?? 0),
    completionTokens: Number(usage.output_tokens ?? 0),
    totalTokens: Number(usage.total_tokens ?? 0),
  };
}

export function sumUsage(first, second) {
  return {
    promptTokens: first.promptTokens + second.promptTokens,
    completionTokens: first.completionTokens + second.completionTokens,
    totalTokens: first.totalTokens + second.totalTokens,
  };
}

/** 코드펜스만 벗기고 전체를 JSON 으로 읽는다. 실패는 PARSE_ERROR. */
export function parseModelJson(rawText) {
  const text = String(rawText ?? "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new AnalysisModelFailureError("PARSE_ERROR");
  }
}

/** 코드펜스·앞뒤 설명을 벗겨 첫 '{' 부터 마지막 '}' 까지를 JSON 으로 읽는다. */
export function parseModelJsonTolerant(rawText) {
  const text = String(rawText ?? "").replace(/```json\s*/gi, "").replace(/```\s*/g, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new AnalysisModelFailureError("PARSE_ERROR");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new AnalysisModelFailureError("PARSE_ERROR");
  }
}
