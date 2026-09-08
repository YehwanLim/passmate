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

const GROUNDING_REDIRECT_HOST = "vertexaisearch.cloud.google.com";
const MAX_EXCERPT_CHARS = 140;

/**
 * groundingSupports 의 segment 텍스트를 부록에 보일 한 줄로 다듬는다. 조사 메모는 "- (YYYY-MM) 사실 — 출처" 줄이라
 * 마지막 사실 줄을 골라 머리표와 출처 꼬리를 뗀다. 단일 파이프라인의 JSON 조각이면 키와 따옴표를 뗀다.
 */
function cleanSupportText(text) {
  const lines = String(text ?? "").split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const isBullet = (line) => /^[-*•]/.test(line);
  const factLines = lines.filter(isBullet);
  let line = (factLines.length > 0 ? factLines[factLines.length - 1] : lines[lines.length - 1]) ?? "";
  line = line.replace(/^[-*•]\s*/, "").replace(/^"[A-Za-z]+":\s*"?/, "").replace(/["\],]+$/, "");
  // 날짜를 모를 때 모델이 형식 예시 "(YYYY)"를 그대로 두는 경우가 있다.
  line = line.replace(/^\((?:YYYY(?:-MM)?)\)\s*/, "");
  const tail = line.lastIndexOf(" — ");
  if (tail > 0) line = line.slice(0, tail);
  line = line.replace(/\s+/g, " ").trim();
  if (line.length === 0) return null;
  return line.length > MAX_EXCERPT_CHARS ? `${line.slice(0, MAX_EXCERPT_CHARS - 1)}…` : line;
}

/** chunk 번호 → 그 출처가 뒷받침한 문장들(등장 순). supports 가 없으면 빈 맵. */
function excerptsByChunk(meta) {
  const map = new Map();
  const supports = meta?.groundingSupports;
  if (!Array.isArray(supports)) return map;
  for (const support of supports) {
    const excerpt = cleanSupportText(support?.segment?.text);
    if (!excerpt) continue;
    for (const index of support?.groundingChunkIndices ?? []) {
      if (!Number.isInteger(index)) continue;
      const list = map.get(index) ?? [];
      if (!list.includes(excerpt)) list.push(excerpt);
      map.set(index, list);
    }
  }
  return map;
}

/** 같은 문장을 여러 출처가 뒷받침하면, 아직 다른 출처에 안 쓴 문장을 우선 고른다. 전부 쓰였으면 첫 문장. */
function pickExcerpt(candidates, used) {
  if (!candidates || candidates.length === 0) return null;
  return candidates.find((excerpt) => !used.has(excerpt)) ?? candidates[0];
}

/**
 * groundingMetadata.groundingChunks[].web 을 1부터 번호 매긴 출처 목록으로 바꾼다.
 * uri 는 Google 리다이렉트 주소, title 은 보통 도메인명이다. 화면은 title 을 보이고 url 로 링크한다.
 * excerpt 는 groundingSupports 로 알아낸 "이 출처가 뒷받침한 사실" 한 줄(없으면 null) — 제목이 도메인뿐이라
 * 독자가 출처를 고를 근거가 이것뿐이다(스펙 §7-1 보완, 2026-09-08).
 */
export function extractGroundingSources(data) {
  const meta = data?.candidates?.[0]?.groundingMetadata;
  const chunks = meta?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const excerpts = excerptsByChunk(meta);
  const used = new Set();
  const byUrl = new Map();
  const sources = [];
  chunks.forEach((chunk, index) => {
    const uri = chunk?.web?.uri;
    if (typeof uri !== "string" || uri.length === 0) return;
    const excerpt = pickExcerpt(excerpts.get(index), used);
    const existing = byUrl.get(uri);
    if (existing) {
      if (existing.excerpt === null && excerpt) { existing.excerpt = excerpt; used.add(excerpt); }
      return;
    }
    if (excerpt) used.add(excerpt);
    if (sources.length >= MAX_SOURCES) return;
    const hostname = hostnameOf(uri);
    const title = typeof chunk.web.title === "string" && chunk.web.title.length > 0 ? chunk.web.title : hostname;
    const publisher = hostname.length === 0 || hostname.endsWith(GROUNDING_REDIRECT_HOST) ? title : hostname;
    const source = { id: sources.length + 1, title, url: uri, publisher, excerpt };
    sources.push(source);
    byUrl.set(uri, source);
  });
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

// ── 사후 정리 ────────────────────────────────────────────────────────────────
// 모델이 프롬프트 제약을 어겨도 화면에 그대로 가지 않게 서버가 좁게 손본다.
// 문장·오타·영어는 건드리지 않는다(내용 변경 금지). 규칙은 프롬프트의 것과 같다.
const MAX_KEYWORDS = 6;
const MAX_KEY_FIGURES = 4;
const RECENCY_MONTHS = 12;

/** "YYYY-MM" 은 그 달, "YYYY" 는 가장 후하게 그 해 12월로 읽는다. 자유 형식은 판정하지 않는다(null). */
function monthIndexOf(when) {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(String(when ?? "").trim());
  if (!match) return null;
  const month = match[2] === undefined ? 12 : Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + (month - 1);
}

/** 기준일보다 12개월 넘게 오래된 항목을 뺀다. 날짜를 못 읽는 항목은 남기고, 전부 빠지면 원본을 돌려준다. */
function dropStaleEntries(items, asOf) {
  if (!Array.isArray(items)) return items;
  const asOfIndex = monthIndexOf(String(asOf ?? "").slice(0, 7));
  if (asOfIndex === null) return items;
  const kept = items.filter((item) => {
    const index = monthIndexOf(item?.when);
    return index === null || asOfIndex - index <= RECENCY_MONTHS;
  });
  return kept.length > 0 ? kept : items;
}

/** "2026년 2분기 매출" → "매출". 라벨에서 기간을 걷어낸 뒤 남는 게 없으면 원래 라벨을 둔다. */
function stripPeriodFromLabel(label, period) {
  if (typeof label !== "string" || typeof period !== "string" || period.length === 0) return label;
  const stripped = label
    .split(period).join(" ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length > 0 ? stripped : label;
}

export function tidyCompanyReport(parsed, asOf) {
  if (!isRecord(parsed)) return parsed;
  const report = { ...parsed };

  if (isRecord(report.brief) && Array.isArray(report.brief.keywords)) {
    report.brief = { ...report.brief, keywords: report.brief.keywords.slice(0, MAX_KEYWORDS) };
  }

  if (isRecord(report.financialSnapshot) && Array.isArray(report.financialSnapshot.keyFigures)) {
    report.financialSnapshot = {
      ...report.financialSnapshot,
      keyFigures: report.financialSnapshot.keyFigures.slice(0, MAX_KEY_FIGURES).map((figure) => (
        isRecord(figure) ? { ...figure, label: stripPeriodFromLabel(figure.label, figure.period) } : figure
      )),
    };
  }

  report.currentIssues = dropStaleEntries(report.currentIssues, asOf);

  // 주소를 확인하지 못한 1차 자료는 뺀다. 모델이 "확인하지 못함" 같은 문자열을 url 에 넣는 경우가 있다.
  if (isRecord(report.interviewPrep) && Array.isArray(report.interviewPrep.primarySources)) {
    report.interviewPrep = {
      ...report.interviewPrep,
      primarySources: report.interviewPrep.primarySources.filter((item) => isRecord(item) && /^https?:\/\//i.test(String(item.url ?? ""))),
    };
  }

  if (isRecord(report.roleInContext)) {
    report.roleInContext = {
      ...report.roleInContext,
      recentNewsForRole: dropStaleEntries(report.roleInContext.recentNewsForRole, asOf),
    };
  }

  return report;
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

// ── 2단 파이프라인(기본, 스펙 §5-5 6항) ──────────────────────────────────────
// 조사(검색, 자유 텍스트 메모, 두 주제 그룹 병렬) → 구성(검색 없이 JSON 모드). 단일 호출은
// 섹션 간 소재 중복을 규칙으로 못 잡았다(09-08 프로브). 구성 단계에 thinking 예산을 더 주어
// 섹션 배분을 맡긴다. 2026-09-08 프로브 4회(삼성전자 3·토스 1) 비교 후 기본값으로 전환.
// "single" 은 비교·복귀용으로 남긴다(프로브 --single).
export const COMPANY_PIPELINES = ["single", "two-stage"];
export const COMPANY_DEFAULT_PIPELINE = "two-stage";
export const COMPANY_COMPOSE_MODEL = "gemini-2.5-flash";
export const COMPANY_RESEARCH_STAGE_TIMEOUT_MS = 55000;
const COMPOSE_THINKING_BUDGET = 2048;

const RESEARCH_MEMO_TOPICS = [
  "1) 사업부문과 돈 버는 구조: 부문별 주력 제품·고객·경쟁사, 부문별 비중 감각(수치는 출처가 있을 때만)",
  "2) 최근 24개월 안에 시작·확대·발표된 주력 사업·신사업과 실제 움직임(투자 규모, 조직 신설, 인수, 발표)",
  "3) 최근 2~3년 실적 방향(매출·영업이익, 회계 기간 명시), 최근 12개월 주요 공시·IR, 상장사면 기준일 무렵 주가·시가총액 흐름(비상장이면 투자 유치·기업가치·주요 투자자). 검색어 예: \"회사명 사업보고서 매출 영업이익\", \"회사명 공시 IR 발표\", \"회사명 시가총액\" 또는 \"회사명 투자 유치 기업가치\"",
  "4) 지원 직무가 붙는 조직·사업부의 실제 이름과, 그 조직이 최근 12개월에 벌인 프로젝트·개편·발표(채용 공고·공채 일정·채용 인원은 제외)",
  "5) 최근 12개월의 핵심 사건 6~8개(주제 2·3과 겹치지 않는 것 위주, 지원 직무와 관계있는 것 우선)",
  "6) 회사가 공식적으로 쓰는 인재상·핵심가치 문구(채용 페이지·회사 소개에서 확인한 원문만. 못 찾으면 '확인하지 못함'). 검색어 예: \"회사명 인재상\", \"회사명 핵심가치 채용\"",
  "7) 지원자가 더 읽을 1차 자료의 실제 주소: 회사 공식 IR 자료실, 뉴스룸, 채용 페이지, 전자공시(DART) 회사 페이지. 검색 결과에서 확인한 주소만 \"라벨 — https://…\" 형식으로 적고, 못 찾은 것은 적지 않는다",
];

// 한 호출에 여섯 주제를 맡기면 주제 1(사업부문)에 검색을 몰아 쓰는 실행이 잦았다(09-08 삼성전자 2회).
// 사업·재무(1~3)와 직무·이슈·인재상(4~6)을 나눠 병렬로 돌린다. 지연은 같고 그라운딩 비용만 2배다.
export const COMPANY_RESEARCH_TOPIC_GROUPS = {
  business: RESEARCH_MEMO_TOPICS.slice(0, 3),
  role: RESEARCH_MEMO_TOPICS.slice(3),
};

const COUNT_WORDS = { 2: "두", 3: "세", 4: "네", 5: "다섯", 6: "여섯" };

/** 1단(조사): 리포트가 아니라 사실 메모만 쓰게 한다. 마스터 프롬프트는 여기에 넣지 않는다. */
export function buildCompanyResearchPrompt(request, asOf, topics = RESEARCH_MEMO_TOPICS) {
  const countWord = COUNT_WORDS[topics.length] ?? String(topics.length);
  let prompt = `당신은 지원자를 위해 회사를 조사하는 리서처입니다. 검색 도구로 아래 ${countWord} 주제를 각각 확인하고, 확인한 사실만 메모로 정리하세요. 리포트를 쓰지 말고 사실 메모만 씁니다.\n\n`;
  prompt += `[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${asOf}\n`;
  if (request.postingText) {
    prompt += `\n[채용공고]\n${request.postingText}\n`;
  }
  prompt += `\n[조사 주제]\n${topics.join("\n")}\n`;
  prompt += `
[검색 규칙]
- ${countWord} 주제 각각에 대해 검색을 최소 2회 한다. 한 주제의 검색 결과로 다른 주제를 채우지 않는다. 실적·공시와 인재상 주제가 있으면 전용 검색어로 따로 확인한다.
- 사건은 기준일에 가까운 것부터 찾는다. 기준일로부터 12개월보다 오래된 사건은 주제 1의 맥락으로만 쓴다.

[메모 규칙]
- 주제별로 제목을 달고, 사실마다 한 줄씩 쓴다. 형식: "- (YYYY-MM) 사실 — 출처 도메인". 월을 모르면 (YYYY)만 쓴다. 날짜는 사건이 실제로 일어난 달이다. 기사 날짜를 붙이지 않는다.
- 지원자가 면접에서 입 밖에 낼 수 없는 사건은 메모에 넣지 않는다: 사내 의혹·비위·수사, 개인 비리, 복지·수당 논란, 소송·분쟁의 세부, 노사 갈등의 감정적 표현, 임직원 개인 신상. 노사 문제는 실적·조직에 직접 영향을 주는 확정 사실(파업 결정 등)만 한 줄로 쓴다.
- 숫자에는 단위와 회계 기간을 붙인다. 확인하지 못한 숫자는 쓰지 않는다.
- 입력된 회사(법인) 하나의 사실만 쓴다. 지주회사·형제 회사·별도 법인 자회사 같은 계열사의 사실은 줄 앞에 "[계열사 이름]"을 붙인다.
- 주제마다 확인한 사실이 없으면 "확인하지 못함"이라고 쓴다.
- 해석·평가·전망·추천을 쓰지 않는다. 확인된 사실만 쓴다.
- 한국어로 쓴다. 각 주제에 사실 5~10줄이면 충분하다.
`;
  return prompt;
}

/** 2단(구성)·복구 공용: 메모의 사실만으로 마스터 프롬프트 스키마를 채우게 한다. */
function buildCompanyComposePrompt(request, asOf, memo) {
  return `${COMPANY_REPORT_SYSTEM_PROMPT}

다음은 검색으로 조사한 메모입니다. 이 메모의 사실만 사용해 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요. 메모에 없는 사실을 추가하지 마세요. "[계열사 이름]"이 붙은 줄은 이 회사의 사업으로 쓰지 말고, 이 회사에 직접 영향을 줄 때만 계열사 이름을 밝혀 currentIssues 에 씁니다. 계열사의 공시·차입·배당은 recentDisclosures 에 넣지 않습니다. 메모에 없는 주제(예: 인재상 "확인하지 못함")는 해당 배열을 비웁니다. 메모의 출처 도메인은 sourceIds 번호 근거로만 쓰고 본문에 옮기지 않습니다. interviewPrep.primarySources 에는 메모에 실제 주소(https://…)가 적힌 자료만 넣고, 주소가 없으면 그 항목을 뺍니다(빈 배열 허용). 메모에 사내 의혹·수당·복지 논란·보상 불만·개인 비위·소송 세부 같은 줄이 있으면 그 줄은 버리고 어느 섹션에도 쓰지 않습니다. 주가·시가총액은 메모에 기준일과 가까운 날짜가 붙은 값만 쓰고, 날짜가 없거나 오래된 값은 쓰지 않습니다.

[기업]: ${request.company}
[직무]: ${request.jobKeyword}
[기준일]: ${asOf}

[조사 메모]
${memo}`;
}

const RESEARCH_TOPICS = [
  "1) 사업부문과 돈 버는 구조(주력 제품·고객·경쟁사)",
  "2) 최근 1~2년 밀고 있는 주력 사업·신사업과 실제 투자·조직 움직임",
  "3) 최근 실적(매출·영업이익 방향), 주요 공시·IR, 상장사면 최근 주가·시가총액 흐름",
  "4) 지원 직무가 붙는 조직·사업부와, 그 조직이 최근 벌인 프로젝트·개편·발표(채용 공고나 공채 일정은 제외)",
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
  pipeline = COMPANY_DEFAULT_PIPELINE,
} = {}) {
  if (!apiKey) throw new AnalysisModelFailureError("API_ERROR");
  if (!COMPANY_PIPELINES.includes(pipeline)) throw new AnalysisModelFailureError("API_ERROR");

  const startedAt = now();
  const deadlineAt = startedAt + COMPANY_TOTAL_DEADLINE_MS;
  const reportDate = asOf ?? todayIsoDate(now);

  if (pipeline === "two-stage") {
    return analyzeCompanyTwoStage(request, { fetcher, now, apiKey, reportDate, startedAt, deadlineAt });
  }

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
  const stages = [{ name: "research", modelName: COMPANY_RESEARCH_MODEL, responseTimeMs: research.responseTimeMs }];

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
        contents: [{ role: "user", parts: [{ text: buildCompanyComposePrompt(request, reportDate, researchText) }] }],
        generationConfig: { responseMimeType: "application/json" },
      },
    });
    parsed = parseModelJsonTolerant(joinCandidateText(repair.data));
    usage = sumUsage(usage, usageOf(repair.data));
    modelName = `${COMPANY_RESEARCH_MODEL}+${repairModel}`;
    httpStatus = repair.httpStatus;
    repaired = true;
    stages.push({ name: "repair", modelName: repairModel, responseTimeMs: repair.responseTimeMs });
  }

  if (!isRecord(parsed)) throw new AnalysisModelFailureError("PARSE_ERROR");
  if (parsed.error === "CONTEXT_IRRELEVANT") return parsed;

  const tidied = tidyCompanyReport(parsed, reportDate);
  const brief = isRecord(tidied.brief) ? { ...tidied.brief, asOf: reportDate } : { asOf: reportDate };
  return {
    ...tidied,
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
      pipeline: "single",
      stages,
    },
  };
}

/**
 * 두 조사 응답의 출처를 url 기준으로 합친다. 한쪽을 먼저 다 넣으면 상한(20)에 다른 쪽이 굶으므로
 * 번갈아 한 개씩 채운다. 번호는 다시 매기고, 발췌는 먼저 채워진 쪽을 남긴다.
 */
function mergeGroundingSources(datas) {
  const lists = datas.map((data) => extractGroundingSources(data));
  const byUrl = new Map();
  const merged = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));
  for (let index = 0; index < longest; index += 1) {
    for (const list of lists) {
      const source = list[index];
      if (!source) continue;
      const existing = byUrl.get(source.url);
      if (existing) {
        if (existing.excerpt === null && source.excerpt) existing.excerpt = source.excerpt;
        continue;
      }
      if (merged.length >= MAX_SOURCES) continue;
      const copy = { ...source, id: merged.length + 1 };
      merged.push(copy);
      byUrl.set(copy.url, copy);
    }
  }
  return merged;
}

/** 검색어는 합치고, 검색 제안 칩은 먼저 온 것을 쓴다(칩 두 벌을 겹쳐 그리지 않는다). */
function mergeGroundingMeta(datas) {
  const metas = datas.map(extractGroundingMeta);
  return {
    searchQueries: metas.flatMap((meta) => meta.searchQueries),
    searchEntryPointHtml: metas.find((meta) => meta.searchEntryPointHtml)?.searchEntryPointHtml ?? null,
  };
}

/** 조사 단계 진단값: 검색 횟수·출처 수·메모 길이. 어느 그룹이 검색을 건너뛰었는지 운영에서 볼 수 있게 남긴다. */
function researchStageMeta(name, call) {
  const meta = call.data?.candidates?.[0]?.groundingMetadata;
  return {
    name,
    modelName: COMPANY_RESEARCH_MODEL,
    responseTimeMs: call.responseTimeMs,
    searchCount: Array.isArray(meta?.webSearchQueries) ? meta.webSearchQueries.length : 0,
    sourceCount: extractGroundingSources(call.data).length,
    memoChars: joinCandidateText(call.data).length,
  };
}

/** 2단: 조사 2회 병렬(검색, 각 ≤55s) → 구성(JSON 모드, 남은 예산). 출처·검색어는 조사 단계에서 온다. */
async function analyzeCompanyTwoStage(request, { fetcher, now, apiKey, reportDate, startedAt, deadlineAt }) {
  const researchCall = (topics) => callGemini({
    apiKey,
    fetcher,
    modelName: COMPANY_RESEARCH_MODEL,
    deadline: { deadlineAt, now, maxMs: COMPANY_RESEARCH_STAGE_TIMEOUT_MS },
    body: {
      contents: [{ role: "user", parts: [{ text: buildCompanyResearchPrompt(request, reportDate, topics) }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: RESEARCH_THINKING_BUDGET },
      },
    },
  });
  const [business, role] = await Promise.all([
    researchCall(COMPANY_RESEARCH_TOPIC_GROUPS.business),
    researchCall(COMPANY_RESEARCH_TOPIC_GROUPS.role),
  ]);
  const memos = [
    ["사업·신사업·재무", joinCandidateText(business.data)],
    ["직무·이슈·인재상", joinCandidateText(role.data)],
  ].filter(([, text]) => text.trim().length > 0);
  if (memos.length === 0) throw new AnalysisModelFailureError("PARSE_ERROR");
  const memo = memos.map(([label, text]) => `## ${label}\n${text.trim()}`).join("\n\n");
  const sources = mergeGroundingSources([business.data, role.data]);
  const grounding = mergeGroundingMeta([business.data, role.data]);

  const compose = await callGemini({
    apiKey,
    fetcher,
    modelName: COMPANY_COMPOSE_MODEL,
    deadline: { deadlineAt, now, maxMs: COMPANY_TOTAL_DEADLINE_MS },
    body: {
      contents: [{ role: "user", parts: [{ text: buildCompanyComposePrompt(request, reportDate, memo) }] }],
      generationConfig: {
        temperature: 0.4,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: COMPOSE_THINKING_BUDGET },
      },
    },
  });
  const parsed = parseModelJsonTolerant(joinCandidateText(compose.data));
  if (!isRecord(parsed)) throw new AnalysisModelFailureError("PARSE_ERROR");
  if (parsed.error === "CONTEXT_IRRELEVANT") return parsed;

  const tidied = tidyCompanyReport(parsed, reportDate);
  const brief = isRecord(tidied.brief) ? { ...tidied.brief, asOf: reportDate } : { asOf: reportDate };
  return {
    ...tidied,
    brief,
    sources,
    reportMeta: {
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: reportDate,
      searchQueries: grounding.searchQueries,
      searchEntryPointHtml: grounding.searchEntryPointHtml,
      linkedResumeAnalysisId: request.resumeAnalysisId ?? null,
      repaired: false,
    },
    analysisMeta: {
      modelProvider: "gemini",
      modelName: `${COMPANY_RESEARCH_MODEL}+${COMPANY_COMPOSE_MODEL}`,
      responseTimeMs: now() - startedAt,
      httpStatus: compose.httpStatus,
      tokenUsage: sumUsage(sumUsage(usageOf(business.data), usageOf(role.data)), usageOf(compose.data)),
      pipeline: "two-stage",
      stages: [
        researchStageMeta("research-business", business),
        researchStageMeta("research-role", role),
        { name: "compose", modelName: COMPANY_COMPOSE_MODEL, responseTimeMs: compose.responseTimeMs },
      ],
    },
  };
}
