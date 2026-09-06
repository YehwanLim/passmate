import { createHash } from "node:crypto";

import { getActiveGeminiModel, readAiModelSettings } from "./ai-model-settings.js";
import { AnalysisModelFailureError } from "./analysis-request-lifecycle.js";
import { ApiError } from "./api-handler.js";
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../shared/prompts/companyReportPrompt.js";

export { COMPANY_REPORT_SYSTEM_PROMPT };

const MAX_NAME_CHARS = 100;
const MAX_POSTING_CHARS = 4000;
// 프로브에서 모델이 40개 이상 자료를 참고했다. 12개는 부록이 너무 얇고, 20개면 화면 한 섹션 분량이다(스펙 §7-1).
const MAX_SOURCES = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// api/analyze.js 의 sanitizeInput 과 같은 규칙. 채용공고 붙여넣기에 태그·스크립트가 섞여 온다.
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

/**
 * POST /api/analyze/company 본문. company·jobKeyword 필수, postingText(≤4000자)·
 * resumeAnalysisId(uuid) 선택. 허용 키 밖의 필드(예: questions)는 자소서 요청이 잘못
 * 들어온 것이므로 거부한다.
 */
export function normalizeCompanyRequest(body) {
  if (!isRecord(body)) throw new ApiError("INVALID_REQUEST", 400);

  const allowedKeys = new Set(["company", "jobKeyword", "postingText", "resumeAnalysisId"]);
  if (!Object.keys(body).every((key) => allowedKeys.has(key))) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (typeof body.company !== "string" || typeof body.jobKeyword !== "string") {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.company.length > MAX_NAME_CHARS || body.jobKeyword.length > MAX_NAME_CHARS) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.postingText !== undefined && (typeof body.postingText !== "string" || body.postingText.length > MAX_POSTING_CHARS)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  if (body.resumeAnalysisId !== undefined && body.resumeAnalysisId !== null
    && (typeof body.resumeAnalysisId !== "string" || !UUID_PATTERN.test(body.resumeAnalysisId))) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  const company = sanitizeInput(body.company);
  const jobKeyword = sanitizeInput(body.jobKeyword);
  if (company.length === 0 || jobKeyword.length === 0) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  return {
    company,
    jobKeyword,
    postingText: sanitizeInput(body.postingText),
    resumeAnalysisId: body.resumeAnalysisId ?? null,
  };
}

/** kind 를 섞어 같은 회사·직무의 자소서 요청 해시와 절대 겹치지 않게 한다. */
export function companyRequestHash(request) {
  return createHash("sha256")
    .update(JSON.stringify({
      kind: "COMPANY",
      company: request.company,
      jobKeyword: request.jobKeyword,
      postingText: request.postingText,
      resumeAnalysisId: request.resumeAnalysisId,
    }))
    .digest("hex");
}

export function buildCompanyProjectTitle(company, jobKeyword) {
  return `${company} ${jobKeyword} 기업 분석`;
}

/** Analysis 행의 자소서 전용 컬럼. NOT NULL 이라 빈 문자열, 글자 수는 없음. */
export function companyAnalysisInput() {
  return { questionText: "", inputText: "", totalChars: null };
}

/** grounded 응답은 parts 가 여러 개로 나뉘어 온다. 텍스트 파트를 모두 이어 붙인다. */
export function joinCandidateText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
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

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/**
 * groundingMetadata.groundingChunks[].web 을 1부터 번호 매긴 출처 목록으로 바꾼다.
 * uri 는 Google 리다이렉트 주소, title 은 보통 도메인명이다. 화면은 title 을 보이고 url 로 링크한다.
 */
export function extractGroundingSources(data) {
  const chunks = data?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const seen = new Set();
  const sources = [];
  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (typeof uri !== "string" || uri.length === 0 || seen.has(uri)) continue;
    seen.add(uri);
    const title = typeof chunk.web.title === "string" && chunk.web.title.length > 0 ? chunk.web.title : hostnameOf(uri);
    const hostname = hostnameOf(uri);
    sources.push({ id: sources.length + 1, title, url: uri, publisher: hostname.length > 0 ? hostname : title });
    if (sources.length >= MAX_SOURCES) break;
  }
  return sources;
}

/** 검색어와 Google 검색 제안 칩(표시 의무). 없으면 빈 값. */
export function extractGroundingMeta(data) {
  const meta = data?.candidates?.[0]?.groundingMetadata;
  const searchQueries = Array.isArray(meta?.webSearchQueries)
    ? meta.webSearchQueries.filter((query) => typeof query === "string")
    : [];
  const rendered = meta?.searchEntryPoint?.renderedContent;
  return {
    searchQueries,
    searchEntryPointHtml: typeof rendered === "string" && rendered.length > 0 ? rendered : null,
  };
}

// ── 모델 호출 ───────────────────────────────────────────────────────────────
// 검색 그라운딩은 응답 시간이 길다. 총 데드라인 95s 를 1차(조사, ≤65s)와 2차(복구)가
// 나눠 쓴다. 100s 모델 타임아웃 < 125s TTL < 120s maxDuration 관계(CLAUDE.md 함정 4) 안이다.
export const COMPANY_RESEARCH_MODEL = "gemini-2.5-flash";
export const COMPANY_TOTAL_DEADLINE_MS = 95000;
export const COMPANY_RESEARCH_TIMEOUT_MS = 65000;
export const COMPANY_REPAIR_MIN_MS = 20000;
// 2.5-flash 의 기본 thinking 은 지연·비용을 늘린다. 조사 품질에 필요한 최소만 남긴다.
const RESEARCH_THINKING_BUDGET = 512;

const RESEARCH_TOPICS = [
  "1) 사업부문과 돈 버는 구조(주력 제품·고객·경쟁사)",
  "2) 최근 1~2년 밀고 있는 주력 사업·신사업과 실제 투자·조직 움직임",
  "3) 최근 실적(매출·영업이익 방향), 주요 공시·IR, 상장사면 최근 주가·시가총액 흐름",
  "4) 지원 직무와 직접 연결된 최근 소식(조직 개편, 채용 확대, 관련 프로젝트)",
  "5) 최근 12개월의 핵심 이슈와 그 의미",
];

export function buildCompanyUserPrompt(request, asOf) {
  let prompt = `[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${asOf}\n`;
  if (request.postingText) {
    prompt += `\n[채용공고]\n${request.postingText}\n`;
  }
  prompt += "\n다음 다섯 주제를 검색 도구로 각각 확인한 뒤, 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요.\n";
  prompt += `${RESEARCH_TOPICS.join("\n")}\n`;
  prompt += "\n각 사실에는 참고한 출처 번호를 sourceIds 로 남기고, 반드시 한국어로 작성하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.";
  return prompt;
}

function todayIsoDate(now) {
  return new Date(now()).toISOString().slice(0, 10);
}

async function fetchWithDeadline(fetcher, url, options, { deadlineAt, now, maxMs }) {
  const remaining = deadlineAt - now();
  const budget = Math.min(remaining, maxMs);
  if (budget <= 0) {
    const error = new Error("Company analysis deadline exceeded");
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

function usageOf(data) {
  const usage = data?.usageMetadata ?? {};
  return {
    promptTokens: Number(usage.promptTokenCount ?? 0),
    completionTokens: Number(usage.candidatesTokenCount ?? 0),
    totalTokens: Number(usage.totalTokenCount ?? 0),
  };
}

function sumUsage(first, second) {
  return {
    promptTokens: first.promptTokens + second.promptTokens,
    completionTokens: first.completionTokens + second.completionTokens,
    totalTokens: first.totalTokens + second.totalTokens,
  };
}

async function callGemini({ apiKey, body, fetcher, modelName, deadline }) {
  const { response, responseTimeMs } = await fetchWithDeadline(
    fetcher,
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    deadline,
  );
  if (!response.ok) {
    const error = new Error("Model request failed");
    error.statusCode = response.status;
    throw error;
  }
  const data = await response.json();
  return { data, responseTimeMs, httpStatus: response.status };
}

/**
 * 1차: 검색 그라운딩 + "JSON만 출력" 지시(2.5 계열은 검색 도구와 responseMimeType 을 함께 못 쓴다).
 * 2차(1차 파싱 실패 시에만): 기본 모델 + JSON 모드로 1차 원문을 스키마에 맞춰 다시 쓴다.
 * 출처는 언제나 1차의 groundingMetadata 에서 온다.
 */
export async function analyzeCompany(request, db, {
  fetcher = globalThis.fetch,
  now = Date.now,
  apiKey = process.env.GEMINI_API_KEY,
  asOf,
} = {}) {
  if (!apiKey) throw new AnalysisModelFailureError("API_ERROR");

  const startedAt = now();
  const deadlineAt = startedAt + COMPANY_TOTAL_DEADLINE_MS;
  const reportDate = asOf ?? todayIsoDate(now);
  const userPrompt = buildCompanyUserPrompt(request, reportDate);

  const research = await callGemini({
    apiKey,
    fetcher,
    modelName: COMPANY_RESEARCH_MODEL,
    deadline: { deadlineAt, now, maxMs: COMPANY_RESEARCH_TIMEOUT_MS },
    body: {
      contents: [{ role: "user", parts: [{ text: `${COMPANY_REPORT_SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.4,
        thinkingConfig: { thinkingBudget: RESEARCH_THINKING_BUDGET },
      },
    },
  });

  const researchText = joinCandidateText(research.data);
  const sources = extractGroundingSources(research.data);
  const grounding = extractGroundingMeta(research.data);
  let usage = usageOf(research.data);
  let modelName = COMPANY_RESEARCH_MODEL;
  let httpStatus = research.httpStatus;
  let parsed;
  let repaired = false;

  try {
    parsed = parseModelJsonTolerant(researchText);
  } catch (parseError) {
    if (deadlineAt - now() < COMPANY_REPAIR_MIN_MS || researchText.trim().length === 0) {
      throw parseError;
    }
    const repairModel = getActiveGeminiModel(await readAiModelSettings(db));
    const repair = await callGemini({
      apiKey,
      fetcher,
      modelName: repairModel,
      deadline: { deadlineAt, now, maxMs: COMPANY_TOTAL_DEADLINE_MS },
      body: {
        contents: [{
          role: "user",
          parts: [{
            text: `${COMPANY_REPORT_SYSTEM_PROMPT}\n\n다음은 검색으로 조사한 메모입니다. 이 메모의 사실만 사용해 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요. 메모에 없는 사실을 추가하지 마세요.\n\n[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${reportDate}\n\n[조사 메모]\n${researchText}`,
          }],
        }],
        generationConfig: { responseMimeType: "application/json" },
      },
    });
    parsed = parseModelJsonTolerant(joinCandidateText(repair.data));
    usage = sumUsage(usage, usageOf(repair.data));
    modelName = `${COMPANY_RESEARCH_MODEL}+${repairModel}`;
    httpStatus = repair.httpStatus;
    repaired = true;
  }

  if (!isRecord(parsed)) throw new AnalysisModelFailureError("PARSE_ERROR");
  if (parsed.error === "CONTEXT_IRRELEVANT") return parsed;

  const brief = isRecord(parsed.brief) ? { ...parsed.brief, asOf: reportDate } : { asOf: reportDate };
  return {
    ...parsed,
    brief,
    sources,
    reportMeta: {
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: reportDate,
      searchQueries: grounding.searchQueries,
      searchEntryPointHtml: grounding.searchEntryPointHtml,
      linkedResumeAnalysisId: request.resumeAnalysisId ?? null,
      repaired,
    },
    analysisMeta: {
      modelProvider: "gemini",
      modelName,
      responseTimeMs: now() - startedAt,
      httpStatus,
      tokenUsage: usage,
    },
  };
}
