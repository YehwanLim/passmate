// 경험 카드 추천 키워드 (POST /api/analyze?keywords=1). 직접 적는 경험 글에서 키워드 2개까지 골라 준다.
// 이미 쓰는 키워드와 뜻이 같으면 그 표기로 맞춰, 같은 뜻의 키워드가 여러 표기로 흩어지지 않게 한다.
// 경험 글·모델 응답은 로그에 남기지 않는다(이 파일은 console 을 쓰지 않는다).
import { KEYWORD_MAX_SUGGESTIONS, buildKeywordPrompt } from "../shared/prompts/keywordPrompt.js";
import { ApiError, sendError, sendJson, sendRateLimited, withApiHandler } from "./api-handler.js";
import { requireActiveApplicationUser } from "./auth.js";
import { EXPERIENCE_LIMITS } from "./experiences.js";
import { callGeminiGenerate, firstCandidateText, parseModelJsonTolerant } from "./model-client.js";
import prisma from "./prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit, refundUserRateLimit } from "./rate-limit.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

// 경험 이름 + 글이 이만큼은 있어야 고를 거리가 있다.
export const KEYWORD_TEXT_MIN = 20;
const KEYWORD_TEXT_MAX = EXPERIENCE_LIMITS.body + EXPERIENCE_LIMITS.text;
// 프롬프트에 넣는 이미 쓰는 키워드 수(자주 쓴 순)
const KNOWN_LIMIT = 40;
// 키워드 고르기는 짧은 분류라 가벼운 모델로 충분하다(분리·공고 정리와 같은 모델).
const KEYWORD_MODEL = "gemini-3.5-flash-lite";
const KEYWORD_TIMEOUT_MS = 15000;

function cleanLine(value) {
  return typeof value === "string" ? sanitizeInput(value).replace(/\s+/g, " ").trim() : "";
}

const keyOf = (tag) => tag.toLowerCase().replace(/\s+/g, "");

export function normalizeKeywordRequest(body) {
  const invalid = () => new ApiError("INVALID_REQUEST", 400);
  if (!isRecord(body) || !Object.keys(body).every((key) => ["title", "text", "tags"].includes(key))) throw invalid();
  const { title = "", text = "", tags = [] } = body;
  if (typeof title !== "string" || typeof text !== "string" || !Array.isArray(tags)) throw invalid();
  if (title.length > EXPERIENCE_LIMITS.title * 2 || text.length > KEYWORD_TEXT_MAX * 2 || tags.length > EXPERIENCE_LIMITS.tags) throw invalid();
  if (!tags.every((tag) => typeof tag === "string")) throw invalid();
  const cleanTitle = cleanLine(title).slice(0, EXPERIENCE_LIMITS.title);
  const cleanText = sanitizeInput(text).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, KEYWORD_TEXT_MAX);
  if ((cleanTitle + cleanText).length < KEYWORD_TEXT_MIN) throw invalid();
  const current = tags.map((tag) => cleanLine(tag).slice(0, EXPERIENCE_LIMITS.tagChars)).filter(Boolean);
  return { title: cleanTitle, text: cleanText, current };
}

/** 이 사용자가 금고에서 쓰는 키워드, 자주 쓴 순(같으면 가나다순). */
export function knownKeywordsOf(rows) {
  const counts = new Map();
  for (const row of rows) for (const tag of row.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
    .map(([tag]) => tag)
    .slice(0, KNOWN_LIMIT);
}

/** 모델 출력(형태 미보장)을 다듬는다. 형태가 틀리면 null. 이미 쓰는 표기로 맞추고, 이미 붙인 것은 뺀다. */
export function normalizeKeywordOutput(output, { known, current }) {
  if (!isRecord(output) || !Array.isArray(output.keywords)) return null;
  const knownByKey = new Map(known.map((tag) => [keyOf(tag), tag]));
  const taken = new Set(current.map(keyOf));
  const keywords = [];
  for (const raw of output.keywords) {
    const cleaned = cleanLine(raw).slice(0, EXPERIENCE_LIMITS.tagChars);
    if (!cleaned) continue;
    const key = keyOf(cleaned);
    if (taken.has(key)) continue;
    taken.add(key);
    keywords.push(knownByKey.get(key) ?? cleaned);
    if (keywords.length >= KEYWORD_MAX_SUGGESTIONS) break;
  }
  return keywords;
}

async function callGeminiKeywords(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const { data } = await callGeminiGenerate({
    apiKey,
    modelName: KEYWORD_MODEL,
    timeoutMs: KEYWORD_TIMEOUT_MS,
    body: {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: "application/json" },
    },
  });
  return parseModelJsonTolerant(firstCandidateText(data));
}

export function createExperienceKeywordsHandler({
  callModel = callGeminiKeywords,
  consumeRateLimit = consumeUserRateLimit,
  refundRateLimit = refundUserRateLimit,
  db = prisma,
  requireUser = requireActiveApplicationUser,
  now = () => new Date(),
} = {}) {
  return async function experienceKeywordsHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);

      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const { title, text, current } = normalizeKeywordRequest(req.body);

      const startedAt = now();
      const policy = USER_RATE_LIMITS.experienceKeywords;
      const rate = await consumeRateLimit(db, { userId, policy, now: startedAt });
      if (!rate.allowed) return sendRateLimited(res, rate, requestId);
      const refund = () => refundRateLimit(db, { userId, policy, now: startedAt });

      const known = knownKeywordsOf(await db.experience.findMany({ where: { userId }, select: { tags: true } }));
      let keywords = null;
      try {
        keywords = normalizeKeywordOutput(await callModel(buildKeywordPrompt({ title, text, known, current })), { known, current });
      } catch {
        keywords = null; // 경험 글·모델 응답은 로그에 남기지 않는다.
      }
      if (keywords === null) {
        await refund();
        throw new ApiError("KEYWORDS_FAILED", 502);
      }
      if (keywords.length === 0) {
        await refund();
        return sendJson(res, 200, { keywords: [], remaining_today: rate.remaining + 1 }, requestId);
      }
      return sendJson(res, 200, { keywords, remaining_today: rate.remaining }, requestId);
    });
  };
}
