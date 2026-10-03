import { ApiError } from "./api-handler.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

// 작업실(내 지원서) 요청 검증. 문항 수·문항 길이 상한은 분석 입력 규칙(resume-analysis.normalizeRequest)과 같게 둬서
// "진단받기"가 형식 때문에 거절되지 않게 한다. 답변 합계 200~6,000자 규칙은 진단 시점에만 적용한다.
export const MAX_APPLICATION_QUESTIONS = 5;
export const MAX_PROMPT_CHARS = 300;
export const MAX_ANSWER_CHARS = 6000;
const MAX_CHAR_LIMIT = 10000;
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

function invalid() {
  return new ApiError("INVALID_REQUEST", 400);
}

function onlyKeys(body, keys) {
  const allowed = new Set(keys);
  if (!Object.keys(body).every((key) => allowed.has(key))) throw invalid();
}

function requiredText(value, max) {
  if (typeof value !== "string" || value.length > max) throw invalid();
  const cleaned = sanitizeInput(value);
  if (cleaned.length === 0) throw invalid();
  return cleaned;
}

function optionalText(value, max) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || value.length > max) throw invalid();
  const cleaned = sanitizeInput(value);
  return cleaned.length > 0 ? cleaned : null;
}

function optionalDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw invalid();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid();
  return date;
}

// 답변은 작성 중인 원문이라 공백·줄바꿈을 그대로 둔다(자동 저장마다 trim 하면 커서가 튄다).
// 화면은 React 가 이스케이프해 그리고, 진단으로 보낼 때 normalizeRequest 가 다시 sanitize 한다.
function draftAnswer(value) {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > MAX_ANSWER_CHARS) throw invalid();
  return value.replace(/\0/g, "");
}

export function normalizeQuestionDrafts(value) {
  if (!Array.isArray(value) || value.length > MAX_APPLICATION_QUESTIONS) throw invalid();
  return value.map((item, index) => {
    if (!isRecord(item)) throw invalid();
    onlyKeys(item, ["prompt", "charLimit", "answer"]);
    if (typeof item.prompt !== "string" || item.prompt.length > MAX_PROMPT_CHARS) throw invalid();
    let charLimit = null;
    if (item.charLimit !== undefined && item.charLimit !== null) {
      if (!Number.isInteger(item.charLimit) || item.charLimit < 1 || item.charLimit > MAX_CHAR_LIMIT) {
        throw invalid();
      }
      charLimit = item.charLimit;
    }
    return {
      position: index + 1,
      prompt: sanitizeInput(item.prompt),
      charLimit,
      answer: draftAnswer(item.answer),
    };
  });
}

export function normalizeProjectCreate(body) {
  if (!isRecord(body)) throw invalid();
  onlyKeys(body, ["company", "jobKeyword", "deadline", "postingSlug", "questions"]);
  let postingSlug = null;
  if (body.postingSlug !== undefined && body.postingSlug !== null) {
    if (typeof body.postingSlug !== "string" || !SLUG_PATTERN.test(body.postingSlug)) throw invalid();
    postingSlug = body.postingSlug;
  }
  return {
    company: requiredText(body.company, 100),
    jobKeyword: optionalText(body.jobKeyword, 100),
    deadline: optionalDate(body.deadline),
    postingSlug,
    questions: normalizeQuestionDrafts(body.questions ?? []),
  };
}

export function normalizeProjectMeta(body) {
  if (!isRecord(body) || Object.keys(body).length === 0) throw invalid();
  onlyKeys(body, ["company", "jobKeyword", "deadline"]);
  const data = {};
  if ("company" in body) data.company = requiredText(body.company, 100);
  if ("jobKeyword" in body) data.jobKeyword = optionalText(body.jobKeyword, 100);
  if ("deadline" in body) data.deadline = optionalDate(body.deadline);
  return data;
}

export function normalizeQuestionSave(body) {
  if (!isRecord(body) || !("questions" in body)) throw invalid();
  onlyKeys(body, ["questions", "baseUpdatedAt"]);
  return {
    questions: normalizeQuestionDrafts(body.questions),
    baseUpdatedAt: optionalDate(body.baseUpdatedAt),
  };
}
