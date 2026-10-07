// 경험 자동 채우기 (POST /api/analyze?extract=1). 예전 자소서에서 경험 후보를 뽑는다.
// 모델 지시는 어겨질 수 있어 서버가 결과를 검사한다: 원문에 없는 근거 → 후보 버림, 근거 없는 숫자 → [실제 수치].
// 자소서 본문·후보·모델 응답은 로그에 남기지 않는다(이 파일은 console 을 쓰지 않는다).
import { EXTRACT_MAX_CANDIDATES, buildExtractPrompt } from "../shared/prompts/extractPrompt.js";
import { ApiError, sendError, sendJson, sendRateLimited, withApiHandler } from "./api-handler.js";
import { requireActiveApplicationUser } from "./auth.js";
import { EXPERIENCE_LIMITS } from "./experiences.js";
import { callGeminiGenerate, firstCandidateText, parseModelJsonTolerant } from "./model-client.js";
import { guardNumbers, numberCores } from "./number-guard.js";
import prisma from "./prisma.js";
import { USER_RATE_LIMITS, consumeUserRateLimit, refundUserRateLimit } from "./rate-limit.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

export const EXTRACT_TEXT_LIMITS = Object.freeze({ min: 200, max: 20000 });
const MAX_RAW_CHARS = EXTRACT_TEXT_LIMITS.max * 2;
const MAX_QUOTES = 2;
const MIN_QUOTE_CHARS = 8;
const MAX_QUOTE_CHARS = 300;
const EXTRACT_MODEL = "gemini-2.5-flash";
const EXTRACT_TIMEOUT_MS = 30000;

export function normalizeExtractRequest(body) {
  const invalid = () => new ApiError("INVALID_REQUEST", 400);
  if (!isRecord(body) || !Object.keys(body).every((key) => key === "text")) throw invalid();
  if (typeof body.text !== "string" || body.text.length > MAX_RAW_CHARS) throw invalid();
  const text = sanitizeInput(body.text)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < EXTRACT_TEXT_LIMITS.min || text.length > EXTRACT_TEXT_LIMITS.max) throw invalid();
  return { text };
}

const squash = (value) => String(value ?? "").replace(/\s+/g, "");

function cleanLine(value) {
  return typeof value === "string" ? sanitizeInput(value).replace(/\s+/g, " ").trim() : "";
}

// 숫자 검사 뒤에 자른다. "[실제 수치]" 가 원래 숫자보다 길어서다.
function fit(value, max, allowed) {
  return guardNumbers(cleanLine(value), allowed).text.slice(0, max);
}

function tagsOf(value) {
  const tags = (Array.isArray(value) ? value : [])
    .map((tag) => cleanLine(tag).slice(0, EXPERIENCE_LIMITS.tagChars))
    .filter((tag) => tag.length > 0);
  return Array.from(new Set(tags)).slice(0, EXPERIENCE_LIMITS.tags);
}

/** 모델 출력(형태 미보장)을 금고에 넣을 수 있는 후보로 다듬는다. 형태가 틀리면 null, 남는 게 없으면 []. */
export function normalizeExtractOutput(output, { sourceText }) {
  if (!isRecord(output) || !Array.isArray(output.candidates)) return null;
  const source = squash(sourceText);
  const allowed = numberCores(sourceText);
  const candidates = [];
  for (const item of output.candidates) {
    if (candidates.length >= EXTRACT_MAX_CANDIDATES) break;
    if (!isRecord(item)) continue;
    const title = fit(item.title, EXPERIENCE_LIMITS.title, allowed);
    if (!title) continue;
    const quotes = (Array.isArray(item.quotes) ? item.quotes : [])
      .map((quote) => cleanLine(quote).slice(0, MAX_QUOTE_CHARS))
      .filter((quote) => quote.length >= MIN_QUOTE_CHARS && source.includes(squash(quote)))
      .slice(0, MAX_QUOTES);
    if (quotes.length === 0) continue;
    candidates.push({
      title,
      period: fit(item.period, EXPERIENCE_LIMITS.period, allowed),
      situation: fit(item.situation, EXPERIENCE_LIMITS.text, allowed),
      action: fit(item.action, EXPERIENCE_LIMITS.text, allowed),
      result: fit(item.result, EXPERIENCE_LIMITS.text, allowed),
      tags: tagsOf(item.tags),
      quotes,
    });
  }
  return candidates;
}

async function callGeminiExtract(promptText) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const { data } = await callGeminiGenerate({
    apiKey,
    modelName: EXTRACT_MODEL,
    timeoutMs: EXTRACT_TIMEOUT_MS,
    body: {
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 1024 } },
    },
  });
  return parseModelJsonTolerant(firstCandidateText(data));
}

export function createExperienceExtractHandler({
  callModel = callGeminiExtract,
  consumeRateLimit = consumeUserRateLimit,
  refundRateLimit = refundUserRateLimit,
  db = prisma,
  requireUser = requireActiveApplicationUser,
  now = () => new Date(),
} = {}) {
  return async function experienceExtractHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);

      const { applicationUser } = await requireUser(req, db);
      const userId = applicationUser.id;
      const { text } = normalizeExtractRequest(req.body);

      // 금고가 꽉 찼으면 뽑아도 넣을 데가 없다. 횟수를 쓰기 전에 막는다.
      const owned = await db.experience.count({ where: { userId } });
      if (owned >= EXPERIENCE_LIMITS.perUser) throw new ApiError("EXPERIENCE_LIMIT_REACHED", 409);

      const startedAt = now();
      const policy = USER_RATE_LIMITS.experienceExtract;
      const rate = await consumeRateLimit(db, { userId, policy, now: startedAt });
      if (!rate.allowed) return sendRateLimited(res, rate, requestId);
      const refund = () => refundRateLimit(db, { userId, policy, now: startedAt });

      let candidates = null;
      try {
        candidates = normalizeExtractOutput(await callModel(buildExtractPrompt({ text })), { sourceText: text });
      } catch {
        candidates = null; // 자소서 본문·모델 응답은 로그에 남기지 않는다.
      }
      if (candidates === null) {
        await refund();
        throw new ApiError("EXTRACT_FAILED", 502);
      }
      if (candidates.length === 0) {
        await refund();
        return sendJson(res, 200, { candidates: [], remaining_today: rate.remaining + 1 }, requestId);
      }
      return sendJson(res, 200, { candidates, remaining_today: rate.remaining }, requestId);
    });
  };
}
