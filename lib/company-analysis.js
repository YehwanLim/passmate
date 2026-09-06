import { createHash } from "node:crypto";

import { AnalysisModelFailureError } from "./analysis-request-lifecycle.js";
import { ApiError } from "./api-handler.js";
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../shared/prompts/companyReportPrompt.js";

export { COMPANY_REPORT_SYSTEM_PROMPT };

const MAX_NAME_CHARS = 100;
const MAX_POSTING_CHARS = 4000;
const MAX_SOURCES = 12;
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
    sources.push({ id: sources.length + 1, title, url: uri, publisher: title });
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
