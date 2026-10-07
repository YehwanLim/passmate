// 경험 자동 채우기 (POST /api/analyze?extract=1). 예전 자소서에서 경험 후보를 뽑는다.
// 모델 지시는 어겨질 수 있어 서버가 결과를 검사한다: 원문에 없는 근거 → 후보 버림, 근거 없는 숫자 → [실제 수치].
// 자소서 본문·후보·모델 응답은 로그에 남기지 않는다(이 파일은 console 을 쓰지 않는다).
import { EXTRACT_MAX_CANDIDATES } from "../shared/prompts/extractPrompt.js";
import { ApiError } from "./api-handler.js";
import { EXPERIENCE_LIMITS } from "./experiences.js";
import { guardNumbers, numberCores } from "./number-guard.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

export const EXTRACT_TEXT_LIMITS = Object.freeze({ min: 200, max: 20000 });
const MAX_RAW_CHARS = EXTRACT_TEXT_LIMITS.max * 2;
const MAX_QUOTES = 2;
const MIN_QUOTE_CHARS = 8;
const MAX_QUOTE_CHARS = 300;

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
