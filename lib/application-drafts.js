import { ApiError } from "./api-handler.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

// 작업실(내 지원서) 요청 검증. 문항 수·문항 길이 상한은 분석 입력 규칙(resume-analysis.normalizeRequest)과 같게 둬서
// "진단받기"가 형식 때문에 거절되지 않게 한다. 답변 합계 200~6,000자 규칙은 진단 시점에만 적용한다.
export const MAX_APPLICATION_QUESTIONS = 5;
export const MAX_PROMPT_CHARS = 300;
export const MAX_ANSWER_CHARS = 6000;
const MAX_CHAR_LIMIT = 10000;
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// 문항 하나에 근거 경험 1~2개(초안 규칙). 소유 확인은 저장 핸들러가 DB 로 한다.
const MAX_DRAFT_EXPERIENCES = 2;
// 지원 현황판 단계(11-15). 기본 6단계는 지우거나 순서를 못 바꾸고, 직접 넣은 단계만 끼워 넣는다.
export const DEFAULT_STAGE_KEYS = ["interest", "writing", "submitted", "doc_passed", "interview", "offer"];
const CUSTOM_STAGE_KEY = /^c_[a-z0-9]{8}$/;
const MAX_STAGE_STEPS = 12;
const MAX_STAGE_LABEL = 20;
const MAX_STAGE_KEY = 40;

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

function draftExperienceIds(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw invalid();
  const ids = [...new Set(value)];
  if (ids.length > MAX_DRAFT_EXPERIENCES) throw invalid();
  if (!ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id))) throw invalid();
  return ids;
}

export function normalizeQuestionDrafts(value) {
  if (!Array.isArray(value) || value.length > MAX_APPLICATION_QUESTIONS) throw invalid();
  return value.map((item, index) => {
    if (!isRecord(item)) throw invalid();
    onlyKeys(item, ["prompt", "charLimit", "answer", "draftExperienceIds"]);
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
      draftExperienceIds: draftExperienceIds(item.draftExperienceIds),
    };
  });
}

export function normalizeProjectCreate(body) {
  if (!isRecord(body)) throw invalid();
  onlyKeys(body, ["company", "jobKeyword", "deadline", "postingSlug", "questions", "stage"]);
  let postingSlug = null;
  if (body.postingSlug !== undefined && body.postingSlug !== null) {
    if (typeof body.postingSlug !== "string" || !SLUG_PATTERN.test(body.postingSlug)) throw invalid();
    postingSlug = body.postingSlug;
  }
  // 새로 만들 때 고를 수 있는 단계는 '관심'(공고 담기)뿐이다. 없으면 DB 기본값(writing).
  if (body.stage !== undefined && body.stage !== "interest") throw invalid();
  return {
    company: requiredText(body.company, 100),
    jobKeyword: optionalText(body.jobKeyword, 100),
    deadline: optionalDate(body.deadline),
    postingSlug,
    stage: body.stage,
    // 새 지원서에는 초안 경험이 있을 수 없다. 소유 확인 없이 저장되지 않게 버린다.
    questions: normalizeQuestionDrafts(body.questions ?? []).map(({ draftExperienceIds: _unused, ...q }) => q),
  };
}

export function normalizeProjectMeta(body) {
  if (!isRecord(body) || Object.keys(body).length === 0) throw invalid();
  onlyKeys(body, ["company", "jobKeyword", "deadline", "jobPostingId", "stage", "stageSteps", "rejected"]);
  const data = {};
  if ("company" in body) data.company = requiredText(body.company, 100);
  if ("jobKeyword" in body) data.jobKeyword = optionalText(body.jobKeyword, 100);
  if ("deadline" in body) data.deadline = optionalDate(body.deadline);
  if ("jobPostingId" in body) {
    // null 은 공고 떼기. 소유 확인은 PATCH 핸들러가 한다.
    if (body.jobPostingId !== null && (typeof body.jobPostingId !== "string" || !UUID_PATTERN.test(body.jobPostingId))) {
      throw invalid();
    }
    data.jobPostingId = body.jobPostingId;
  }
  // stage 가 단계 목록에 있는지는 저장된 목록이 필요해서 PATCH 핸들러가 본다.
  if ("stage" in body) {
    if (typeof body.stage !== "string" || body.stage.length === 0 || body.stage.length > MAX_STAGE_KEY) throw invalid();
    data.stage = body.stage;
  }
  if ("stageSteps" in body) data.stageSteps = normalizeStageSteps(body.stageSteps);
  if ("rejected" in body) {
    if (typeof body.rejected !== "boolean") throw invalid();
    data.rejected = body.rejected;
  }
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

// 단계 목록 검사. null 은 받지 않는다(JSON 칸 null 은 Prisma.DbNull 이 필요해서, 되돌리기도 기본 배열로 보낸다).
export function normalizeStageSteps(value) {
  if (!Array.isArray(value) || value.length < DEFAULT_STAGE_KEYS.length || value.length > MAX_STAGE_STEPS) throw invalid();
  const seen = new Set();
  const builtins = [];
  const steps = value.map((item) => {
    if (!isRecord(item) || typeof item.key !== "string" || seen.has(item.key)) throw invalid();
    seen.add(item.key);
    if (DEFAULT_STAGE_KEYS.includes(item.key)) {
      onlyKeys(item, ["key"]);
      builtins.push(item.key);
      return { key: item.key };
    }
    if (!CUSTOM_STAGE_KEY.test(item.key)) throw invalid();
    onlyKeys(item, ["key", "label"]);
    return { key: item.key, label: requiredText(item.label, MAX_STAGE_LABEL) };
  });
  if (builtins.join(",") !== DEFAULT_STAGE_KEYS.join(",") || steps[steps.length - 1].key !== "offer") throw invalid();
  return steps;
}

/** 저장된 단계 목록(NULL 이면 기본)의 키들. */
export function stageKeysOf(steps) {
  return Array.isArray(steps) ? steps.map((step) => step.key) : [...DEFAULT_STAGE_KEYS];
}
