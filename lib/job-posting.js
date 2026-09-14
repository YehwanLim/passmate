import { ApiError, sendError, sendJson, sendRateLimited, withApiHandler } from "./api-handler.js";
import { requireActiveApplicationUser } from "./auth.js";
import { fetchPostingText } from "./job-posting-fetch.js";
import { callGeminiGenerate, firstCandidateText } from "./model-client.js";
import prisma from "./prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit } from "./rate-limit.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

// 채용공고 준비 API (POST /api/analyze?posting=1). URL 이나 붙여넣은 본문을 정제해 flash-lite 로
// 자격요건·우대사항·키워드를 뽑고 job_postings 에 저장한다. 자소서 분석은 돌려준 id 만 참조한다.
// 크레딧은 쓰지 않고 레이트리밋으로만 비용을 막는다. 공고 본문·URL 은 로그에 남기지 않는다.

/** 클라이언트 client/src/lib/jobPosting.ts 의 상수와 함께 움직인다. */
export const MAX_POSTING_CHARS = 6000;
export const MIN_POSTING_CHARS = 200;
export const MAX_POSTING_URL_CHARS = 2048;
const MAX_LIST_ITEMS = 8;
const MAX_ITEM_CHARS = 120;
const MAX_TITLE_CHARS = 120;
const EXTRACT_MODEL = "gemini-2.5-flash-lite";
const EXTRACT_TIMEOUT_MS = 30000;

const SUMMARY_LIST_KEYS = ["responsibilities", "requirements", "preferred", "keywords"];
const SUMMARY_TEXT_KEYS = ["title", "company", "role"];

// 규칙 나열보다 스키마 필드 설명을 따르는 모델이라, 지시는 각 필드 설명에 쓴다.
const EXTRACT_INSTRUCTIONS = [
  "다음은 채용공고에서 추출한 원문 텍스트다. 공고 내용을 아래 JSON 으로 정리한다.",
  "원문에 있는 표현을 보존하고 없는 내용을 지어내지 않는다. 모든 값은 한국어로 쓴다.",
  "채용공고가 아닌 문서(자기소개서, 뉴스, 무작위 텍스트 등)면 {\"error\":\"NOT_JOB_POSTING\"} 만 반환한다.",
  "JSON 외 다른 텍스트는 절대 포함하지 않는다.",
  "{",
  '  "title": "공고 제목 (없으면 빈 문자열)",',
  '  "company": "채용 기업명 (없으면 빈 문자열)",',
  '  "role": "채용 직무명 (없으면 빈 문자열)",',
  `  "responsibilities": ["수행 업무를 원문 표현 그대로 한 항목씩, 최대 ${MAX_LIST_ITEMS}개, 각 ${MAX_ITEM_CHARS}자 이내"],`,
  `  "requirements": ["자격요건(필수)을 원문 표현 그대로 한 항목씩, 최대 ${MAX_LIST_ITEMS}개"],`,
  `  "preferred": ["우대사항을 원문 표현 그대로 한 항목씩, 최대 ${MAX_LIST_ITEMS}개"],`,
  `  "keywords": ["자소서에 드러나야 할 핵심 역량·도구·도메인 키워드 3~${MAX_LIST_ITEMS}개, 각 2~6단어"]`,
  "}",
].join("\n");

export const EMPTY_SUMMARY = Object.freeze({
  title: "",
  company: "",
  role: "",
  responsibilities: [],
  requirements: [],
  preferred: [],
  keywords: [],
});

function cleanText(value, maxChars) {
  return sanitizeInput(value).replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const items = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = cleanText(item, MAX_ITEM_CHARS);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    items.push(text);
    if (items.length >= MAX_LIST_ITEMS) break;
  }
  return items;
}

/**
 * 모델 출력(형태 미보장)을 요약 스키마로 다듬는다. 자격요건과 키워드가 모두 비면 공고로 볼 수 없어 null.
 * {"error":"NOT_JOB_POSTING"} 도 null.
 */
export function normalizePostingSummary(output) {
  if (!isRecord(output) || typeof output.error === "string") return null;
  const summary = { ...EMPTY_SUMMARY };
  for (const key of SUMMARY_TEXT_KEYS) {
    summary[key] = typeof output[key] === "string" ? cleanText(output[key], MAX_TITLE_CHARS) : "";
  }
  for (const key of SUMMARY_LIST_KEYS) {
    summary[key] = cleanList(output[key]);
  }
  if (summary.requirements.length === 0 && summary.keywords.length === 0) return null;
  return summary;
}

/** 본문은 url 또는 text 정확히 하나. text 는 정리 후 200~6,000자, url 은 길이·형식만 여기서 본다. */
export function normalizePostingRequest(body) {
  if (!isRecord(body)) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  const keys = Object.keys(body);
  if (keys.length !== 1 || !["url", "text"].includes(keys[0])) {
    throw new ApiError("INVALID_REQUEST", 400);
  }

  if (keys[0] === "url") {
    if (typeof body.url !== "string") throw new ApiError("INVALID_REQUEST", 400);
    const url = body.url.trim();
    if (url.length === 0 || url.length > MAX_POSTING_URL_CHARS || !/^https?:\/\//i.test(url)) {
      throw new ApiError("INVALID_REQUEST", 400);
    }
    return { url };
  }

  if (typeof body.text !== "string") throw new ApiError("INVALID_REQUEST", 400);
  const text = sanitizeInput(body.text);
  if (text.length < MIN_POSTING_CHARS || text.length > MAX_POSTING_CHARS) {
    throw new ApiError("INVALID_REQUEST", 400);
  }
  return { text };
}

async function callGeminiExtract(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");

  const { data } = await callGeminiGenerate({
    apiKey,
    modelName: EXTRACT_MODEL,
    timeoutMs: EXTRACT_TIMEOUT_MS,
    body: {
      contents: [{ role: "user", parts: [{ text: `${EXTRACT_INSTRUCTIONS}\n\n---\n${text}` }] }],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
  const rawText = firstCandidateText(data);
  if (!rawText) throw new Error("Empty model response");
  return JSON.parse(rawText);
}

/** 응답 필드명은 클라이언트 파서(client/src/lib/jobPosting.ts)가 강제한다. */
export function jobPostingResponse(row) {
  return {
    job_posting_id: row.id,
    source_url: row.sourceUrl ?? null,
    summary: row.summaryJson,
    char_count: row.rawText.length,
  };
}

export function createJobPostingHandler({
  callModel = callGeminiExtract,
  consumeRateLimit = consumeUserRateLimit,
  db = prisma,
  fetchText = fetchPostingText,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function jobPostingHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const { applicationUser } = await requireUser(req, db);
      const request = normalizePostingRequest(req.body);

      const rate = await consumeRateLimit(db, {
        userId: applicationUser.id,
        policy: USER_RATE_LIMITS.jobPosting,
      });
      if (!rate.allowed) return sendRateLimited(res, rate, requestId);

      let rawText = request.text ?? null;
      if (request.url) {
        // fetchText 는 SSRF 거부(400)와 읽기 실패(422)를 ApiError 로 던진다.
        rawText = sanitizeInput(await fetchText(request.url));
        if (rawText.length < MIN_POSTING_CHARS) {
          throw new ApiError("POSTING_URL_UNREADABLE", 422);
        }
        rawText = rawText.slice(0, MAX_POSTING_CHARS);
      }

      let summary;
      try {
        summary = normalizePostingSummary(await callModel(rawText));
      } catch {
        // 공고 본문은 로그에 남기지 않는다.
        throw new ApiError("POSTING_EXTRACT_FAILED", 502);
      }
      if (!summary) {
        throw new ApiError("POSTING_NOT_RECOGNIZED", 422);
      }

      const row = await db.jobPosting.create({
        data: {
          userId: applicationUser.id,
          sourceUrl: request.url ?? null,
          rawText,
          summaryJson: summary,
        },
        select: { id: true, sourceUrl: true, rawText: true, summaryJson: true },
      });

      return sendJson(res, 200, jobPostingResponse(row), requestId);
    });
  };
}
