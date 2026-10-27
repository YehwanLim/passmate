import { createHash } from "node:crypto";

import { getActiveGeminiModel, readAiModelSettings } from "./ai-model-settings.js";
import { AnalysisModelFailureError } from "./analysis-request-lifecycle.js";
import { ApiError } from "../api-handler.js";
import {
  callGeminiGenerate,
  geminiUsage,
  joinCandidateText,
  parseModelJsonTolerant,
  sumUsage,
} from "./model-client.js";
import { getCompanyAnalysisThroughputPolicy } from "../rate-limit.js";
import { isRecord, sanitizeInput } from "../sanitize.js";
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../../shared/prompts/companyReportPrompt.js";

export { COMPANY_REPORT_SYSTEM_PROMPT, joinCandidateText, parseModelJsonTolerant };

const MAX_NAME_CHARS = 100;
const MAX_POSTING_CHARS = 4000;
// 프로브에서 모델이 40개 이상 자료를 참고했다. 12개는 부록이 너무 얇고, 20개면 화면 한 섹션 분량이다(스펙 §7-1).
const MAX_SOURCES = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

/** 연결할 자소서 분석이 지정되면 본인 소유의 RESUME 분석인지 확인한다. */
export async function verifyCompanyRequest(request, { db, userId }) {
  if (!request.resumeAnalysisId) return;
  const owned = await db.analysis.findFirst({
    where: { id: request.resumeAnalysisId, userId, kind: "RESUME" },
    select: { id: true },
  });
  if (!owned) throw new ApiError("RESUME_ANALYSIS_NOT_FOUND", 404);
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
const MAX_COMPETITORS = 3;
const MAX_LEADERSHIP_MESSAGES = 2;
const MAX_LEADERSHIP_KEYWORDS = 4;
// 신년사는 1월에 나온다. 12개월로 자르면 12월 기준일 리포트에서 그해 신년사가 빠진다.
const LEADERSHIP_RECENCY_MONTHS = 15;
const MAX_GLOSSARY_TERMS = 6;

/** "YYYY-MM" 은 그 달, "YYYY" 는 가장 후하게 그 해 12월로 읽는다. 자유 형식은 판정하지 않는다(null). */
function monthIndexOf(when) {
  const match = /^(\d{4})(?:-(\d{2}))?$/.exec(String(when ?? "").trim());
  if (!match) return null;
  const month = match[2] === undefined ? 12 : Number(match[2]);
  if (month < 1 || month > 12) return null;
  return Number(match[1]) * 12 + (month - 1);
}

/**
 * 기준일보다 months 개월 넘게 오래된 항목을 뺀다. 날짜를 못 읽는 항목은 남긴다.
 * 필수 목록은 전부 빠지면 원본을 돌려주고, 비어도 되는 목록(allowEmpty)은 빈 배열을 돌려준다.
 */
function dropStaleEntries(items, asOf, { months = RECENCY_MONTHS, allowEmpty = false } = {}) {
  if (!Array.isArray(items)) return items;
  const asOfIndex = monthIndexOf(String(asOf ?? "").slice(0, 7));
  if (asOfIndex === null) return items;
  const kept = items.filter((item) => {
    const index = monthIndexOf(item?.when);
    return index === null || asOfIndex - index <= months;
  });
  return kept.length > 0 || allowEmpty ? kept : items;
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

  if (isRecord(report.competitorComparison) && Array.isArray(report.competitorComparison.items)) {
    report.competitorComparison = {
      ...report.competitorComparison,
      items: report.competitorComparison.items.slice(0, MAX_COMPETITORS),
    };
  }

  // 오래된 신년사는 '최근 강조한 말'이 아니다. 못 찾은 회사가 많아 빈 목록을 허용한다(화면이 안내 문구를 보인다).
  if (isRecord(report.leadershipMessages) && Array.isArray(report.leadershipMessages.items)) {
    const fresh = dropStaleEntries(report.leadershipMessages.items, asOf, { months: LEADERSHIP_RECENCY_MONTHS, allowEmpty: true });
    report.leadershipMessages = {
      ...report.leadershipMessages,
      items: fresh.slice(0, MAX_LEADERSHIP_MESSAGES).map((message) => (
        isRecord(message) && Array.isArray(message.keywords)
          ? { ...message, keywords: message.keywords.slice(0, MAX_LEADERSHIP_KEYWORDS) }
          : message
      )),
    };
  }

  if (Array.isArray(report.glossary)) {
    report.glossary = report.glossary
      .filter((entry) => isRecord(entry) && String(entry.term ?? "").trim().length > 0 && String(entry.plain ?? "").trim().length > 0)
      .slice(0, MAX_GLOSSARY_TERMS);
  }

  return report;
}

// ── 모델 호출 ───────────────────────────────────────────────────────────────
// 검색 그라운딩은 응답 시간이 길다. 총 데드라인을 조사(≤55s, 단일은 ≤65s)와 구성·복구가 나눠 쓴다.
// 자소서 분석과 같은 150s — 모델 150s < TTL 175s < maxDuration 180s(CLAUDE.md 함정 4).
// 10-12 경쟁사·경영진 메시지·용어 풀이를 더하자 구성이 45~69s 로 늘었다(옛 95s 는 빠듯했다). 조사 ≤70s 뒤에도 구성에 80s 가 남는다.
export const COMPANY_RESEARCH_MODEL = "gemini-3.8-flash";
export const COMPANY_TOTAL_DEADLINE_MS = 150000;
export const COMPANY_RESEARCH_TIMEOUT_MS = 65000;
export const COMPANY_REPAIR_MIN_MS = 20000;
// 기본 thinking 은 지연·비용을 늘린다. 조사 품질에 필요한 최소만 남긴다(2.5 의 예산 512 → 3.x 단계 low).
// 3.x 는 temperature 를 기본값 1.0 으로 두라고 권한다(낮추면 반복·품질 저하). 그래서 temperature 를 주지 않는다.
const RESEARCH_THINKING_LEVEL = "low";

// ── 2단 파이프라인(기본, 스펙 §5-5 6항) ──────────────────────────────────────
// 조사(검색, 자유 텍스트 메모, 두 주제 그룹 병렬) → 구성(검색 없이 JSON 모드). 단일 호출은
// 섹션 간 소재 중복을 규칙으로 못 잡았다(09-08 프로브). 구성 단계에 thinking 예산을 더 주어
// 섹션 배분을 맡긴다. 2026-09-08 프로브 4회(삼성전자 3·토스 1) 비교 후 기본값으로 전환.
// "single" 은 비교·복귀용으로 남긴다(프로브 --single).
export const COMPANY_PIPELINES = ["single", "two-stage"];
export const COMPANY_DEFAULT_PIPELINE = "two-stage";
export const COMPANY_COMPOSE_MODEL = "gemini-3.8-flash";
// 조사 응답 시간은 요청마다 제멋대로다(10-13 같은 시각 실측: 검색 3번에 53s, 8번에 25s — 주제 수·검색 횟수와 무관).
// 대부분 25s 안팎이고 가끔 60s 를 넘는다. 사업·직무 조사는 이 창 안에 끝나야 한다.
export const COMPANY_RESEARCH_STAGE_TIMEOUT_MS = 70000;
// 일시 오류(429·500·503)는 같은 요청을 한 번 더 보낸다. 자소서 분석은 모델 후보를 바꿔 가며 같은 판단을 한다(resume-analysis.js).
// 타임아웃은 다시 보내지 않는다 — 그 단계의 예산을 이미 다 썼다. 재시도는 남은 시간이 최소치 이상일 때만 한다.
const RETRYABLE_MODEL_STATUS = [429, 500, 503];
export const COMPANY_MODEL_RETRY_DELAY_MS = 1000;
export const COMPANY_RESEARCH_RETRY_MIN_MS = 15000;
export const COMPANY_COMPOSE_RETRY_MIN_MS = 45000;
// 경쟁사·경영진 메시지는 본 구성과 따로 간다(본 구성이 이 조사를 기다리지 않는다). 창을 95s 로 넓히고,
// 끝나면 두 칸만 짧게 구성한다.
export const COMPANY_MARKET_RESEARCH_WINDOW_MS = 95000;
export const COMPANY_MARKET_COMPOSE_RETRY_MIN_MS = 15000;
// 늦은 조사에 같은 요청을 하나 더 보내는 방식(30s·20s 뒤)은 10-13 실측 6회 모두 사본이 원 요청보다 늦어 뺐다.
const COMPOSE_THINKING_LEVEL = "medium";

const RESEARCH_MEMO_TOPICS = [
  "1) 사업부문과 돈 버는 구조: 부문별 주력 제품·고객·경쟁사, 부문별 비중 감각(수치는 출처가 있을 때만)",
  "2) 최근 24개월 안에 시작·확대·발표된 주력 사업·신사업과 실제 움직임(투자 규모, 조직 신설, 인수, 발표)",
  "3) 최근 2~3년 실적 방향(매출·영업이익, 회계 기간 명시), 최근 12개월 주요 공시·IR, 상장사면 기준일 무렵 주가·시가총액 흐름(비상장이면 투자 유치·기업가치·주요 투자자). 검색어 예: \"회사명 사업보고서 매출 영업이익\", \"회사명 공시 IR 발표\", \"회사명 시가총액\" 또는 \"회사명 투자 유치 기업가치\"",
  "4) 지원 직무가 붙는 조직·사업부의 실제 이름과, 그 조직이 최근 12개월에 벌인 프로젝트·개편·발표(채용 공고·공채 일정·채용 인원은 제외)",
  "5) 최근 12개월의 핵심 사건 6~8개(주제 2·3과 겹치지 않는 것 위주, 지원 직무와 관계있는 것 우선)",
  "6) 회사가 공식적으로 쓰는 인재상·핵심가치 문구(채용 페이지·회사 소개에서 확인한 원문만. 못 찾으면 '확인하지 못함'). 검색어 예: \"회사명 인재상\", \"회사명 핵심가치 채용\"",
  "7) 지원자가 더 읽을 1차 자료의 실제 주소: 회사 공식 IR 자료실, 뉴스룸, 채용 페이지, 전자공시(DART) 회사 페이지. 검색 결과에서 확인한 주소만 \"라벨 — https://…\" 형식으로 적고, 못 찾은 것은 적지 않는다",
  "8) 주요 경쟁사 2~3곳: 같은 시장에서 맞붙는 회사 이름과, 이 회사와 다른 점(주력 제품·고객·사업 비중·전략의 차이). 점유율·순위는 출처가 있을 때만. 검색어 예: \"회사명 경쟁사\", \"회사명 경쟁사명 비교\"",
  "9) 대표이사(그룹 공채면 그룹 회장)의 가장 최근 신년사와 창립기념사: 날짜, 말한 사람의 직함과 이름, 핵심 키워드, 기사에 따옴표로 인용된 원문 구절. 기준일로부터 15개월보다 오래된 것은 쓰지 않는다. 검색어 예: \"회사명 신년사\", \"회사명 창립 기념사\". 못 찾으면 '확인하지 못함'",
];

// 한 호출에 여섯 주제를 맡기면 주제 1(사업부문)에 검색을 몰아 쓰는 실행이 잦았다(09-08 삼성전자 2회).
// 사업·재무(1~3), 직무·이슈·인재상(4~7), 경쟁사·경영진 메시지(8~9)를 나눠 병렬로 돌린다.
// 지연은 같고 그라운딩 호출만 묶음 수만큼 는다(10-12 경쟁사·신년사 추가로 2 → 3).
export const COMPANY_RESEARCH_TOPIC_GROUPS = {
  business: RESEARCH_MEMO_TOPICS.slice(0, 3),
  role: RESEARCH_MEMO_TOPICS.slice(3, 7),
  market: RESEARCH_MEMO_TOPICS.slice(7),
};

const COUNT_WORDS = { 2: "두", 3: "세", 4: "네", 5: "다섯", 6: "여섯" };

/** 1단(조사): 리포트가 아니라 사실 메모만 쓰게 한다. 마스터 프롬프트는 여기에 넣지 않는다. */
export function buildCompanyResearchPrompt(request, asOf, topics = RESEARCH_MEMO_TOPICS) {
  const countWord = COUNT_WORDS[topics.length] ?? String(topics.length);
  // 검색은 1회마다 과금된다(Gemini 3 그라운딩 $14/1,000회). 10-12까지 "주제마다 최소 2회"로 리포트 1건에 17~20회를 썼다.
  const maxSearches = topics.length + 1;
  let prompt = `당신은 지원자를 위해 회사를 조사하는 리서처입니다. 검색 도구로 아래 ${countWord} 주제를 각각 확인하고, 확인한 사실만 메모로 정리하세요. 리포트를 쓰지 말고 사실 메모만 씁니다.\n\n`;
  prompt += `[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${asOf}\n`;
  if (request.postingText) {
    prompt += `\n[채용공고]\n${request.postingText}\n`;
  }
  prompt += `\n[조사 주제]\n${topics.join("\n")}\n`;
  prompt += `
[검색 규칙]
- 주제마다 검색은 1회를 기본으로 하고, 그 검색으로 확인하지 못했을 때만 1회 더 한다. 이 조사 전체의 검색은 ${maxSearches}회를 넘기지 않는다.
- 한 주제의 검색 결과로 다른 주제를 채우지 않는다. 실적·공시와 인재상 주제가 있으면 전용 검색어로 따로 확인한다.
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
const COMPOSE_MODE_NOTES = {
  full: "",
  // 2단 본 구성: 경쟁사·경영진 메시지는 따로 구성한다.
  main: "\n\n경쟁사 비교와 경영진 메시지는 따로 작성합니다. competitorComparison 과 leadershipMessages 는 출력하지 않습니다.",
  // 2단 경쟁사·경영진 구성: 두 칸만.
  market: "\n\n이번에는 리포트 전체가 아니라 competitorComparison 과 leadershipMessages 두 키만 담은 JSON 객체를 출력합니다. 다른 키는 출력하지 않습니다.",
};

function buildCompanyComposePrompt(request, asOf, memo, { mode = "full" } = {}) {
  const marketNote = COMPOSE_MODE_NOTES[mode] ?? "";
  return `${COMPANY_REPORT_SYSTEM_PROMPT}

다음은 검색으로 조사한 메모입니다. 이 메모의 사실만 사용해 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요. 메모에 없는 사실을 추가하지 마세요. "[계열사 이름]"이 붙은 줄은 이 회사의 사업으로 쓰지 말고, 이 회사에 직접 영향을 줄 때만 계열사 이름을 밝혀 currentIssues 에 씁니다. 계열사의 공시·차입·배당은 recentDisclosures 에 넣지 않습니다. 메모에 없는 주제(예: 인재상 "확인하지 못함")는 해당 배열을 비웁니다. 메모의 출처 도메인은 sourceIds 번호 근거로만 쓰고 본문에 옮기지 않습니다. interviewPrep.primarySources 에는 메모에 실제 주소(https://…)가 적힌 자료만 넣고, 주소가 없으면 그 항목을 뺍니다(빈 배열 허용). 메모에 사내 의혹·수당·복지 논란·보상 불만·개인 비위·소송 세부 같은 줄이 있으면 그 줄은 버리고 어느 섹션에도 쓰지 않습니다. 주가·시가총액은 메모에 기준일과 가까운 날짜가 붙은 값만 쓰고, 날짜가 없거나 오래된 값은 쓰지 않습니다. 경영진 메시지의 quote 는 메모에 따옴표로 적힌 구절만 옮기고, 그런 구절이 없으면 빈 문자열로 둡니다.${marketNote}

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
  "6) 주요 경쟁사 2~3곳과 이 회사와 다른 점",
  "7) 대표이사(또는 그룹 회장)의 가장 최근 신년사·창립기념사와 핵심 키워드",
];

export function buildCompanyUserPrompt(request, asOf) {
  let prompt = `[기업]: ${request.company}\n[직무]: ${request.jobKeyword}\n[기준일]: ${asOf}\n`;
  if (request.postingText) {
    prompt += `\n[채용공고]\n${request.postingText}\n`;
  }
  prompt += "\n다음 일곱 주제를 검색 도구로 각각 확인한 뒤, 마스터 프롬프트의 JSON 스키마로 리포트를 작성하세요.\n";
  prompt += `${RESEARCH_TOPICS.join("\n")}\n`;
  prompt += "\n각 사실에는 참고한 출처 번호를 sourceIds 로 남기고, 반드시 한국어로 작성하세요. JSON 외에 다른 텍스트는 절대 포함하지 마세요.";
  return prompt;
}

function todayIsoDate(now) {
  return new Date(now()).toISOString().slice(0, 10);
}

/** 두 파이프라인이 같은 꼬리를 쓴다: 사후 정리 → 기준일 → 출처·검색 메타 → 분석 메타. */
function finalizeCompanyReport(parsed, { reportDate, sources, grounding, request, repaired, analysisMeta }) {
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
      ...analysisMeta,
    },
  };
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
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!apiKey) throw new AnalysisModelFailureError("API_ERROR");
  if (!COMPANY_PIPELINES.includes(pipeline)) throw new AnalysisModelFailureError("API_ERROR");

  const startedAt = now();
  const deadlineAt = startedAt + COMPANY_TOTAL_DEADLINE_MS;
  const reportDate = asOf ?? todayIsoDate(now);

  if (pipeline === "two-stage") {
    return analyzeCompanyTwoStage(request, { fetcher, now, sleep, apiKey, reportDate, startedAt, deadlineAt });
  }

  const userPrompt = buildCompanyUserPrompt(request, reportDate);

  const research = await callGeminiGenerate({
    apiKey,
    fetcher,
    modelName: COMPANY_RESEARCH_MODEL,
    deadline: { deadlineAt, now, maxMs: COMPANY_RESEARCH_TIMEOUT_MS },
    body: {
      contents: [{ role: "user", parts: [{ text: `${COMPANY_REPORT_SYSTEM_PROMPT}\n\n${userPrompt}` }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        thinkingConfig: { thinkingLevel: RESEARCH_THINKING_LEVEL },
      },
    },
  });

  const researchText = joinCandidateText(research.data);
  const sources = extractGroundingSources(research.data);
  const grounding = extractGroundingMeta(research.data);
  let usage = geminiUsage(research.data);
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
    const repair = await callGeminiGenerate({
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
    usage = sumUsage(usage, geminiUsage(repair.data));
    modelName = `${COMPANY_RESEARCH_MODEL}+${repairModel}`;
    httpStatus = repair.httpStatus;
    repaired = true;
    stages.push({ name: "repair", modelName: repairModel, responseTimeMs: repair.responseTimeMs });
  }

  if (!isRecord(parsed)) throw new AnalysisModelFailureError("PARSE_ERROR");
  if (parsed.error === "CONTEXT_IRRELEVANT") return parsed;

  return finalizeCompanyReport(parsed, {
    reportDate,
    sources,
    grounding,
    request,
    repaired,
    analysisMeta: {
      modelName,
      responseTimeMs: now() - startedAt,
      httpStatus,
      tokenUsage: usage,
      pipeline: "single",
      stages,
    },
  });
}

/**
 * 조사 응답들의 출처를 url 기준으로 합친다. 한쪽을 먼저 다 넣으면 상한(20)에 다른 쪽이 굶으므로
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

/** 일시 오류면 deadlineAt 안에서 한 번 더 부른다. 다시 부른 결과에는 retried 표시를 단다(운영 진단용). */
async function callWithRetry(call, { deadlineAt, now, sleep, minRemainingMs }) {
  try {
    return await call();
  } catch (error) {
    if (!RETRYABLE_MODEL_STATUS.includes(error?.statusCode)) throw error;
    if (deadlineAt - now() - COMPANY_MODEL_RETRY_DELAY_MS < minRemainingMs) throw error;
    await sleep(COMPANY_MODEL_RETRY_DELAY_MS);
    return { ...(await call()), retried: true };
  }
}

/** 실패한 단계의 진단값. 상태 코드가 없으면 시간 초과다. */
function failedStageMeta(name, modelName, error) {
  return {
    name,
    modelName,
    failed: error?.name === "AbortError" ? "TIMEOUT" : (Number.isInteger(error?.statusCode) ? error.statusCode : "ERROR"),
  };
}

const withRetryFlag = (call) => (call.retried ? { retried: true } : {});

/**
 * 2단: 사업·직무 조사 2회 병렬(검색, 같은 ≤70s 창) → 본 구성(JSON 모드, 남은 예산).
 * 경쟁사·경영진 메시지는 옆에서 따로: 조사(≤95s 창) → 두 칸만 구성. 본 구성은 이 조사를 기다리지 않고,
 * 끝에 두 결과를 합친다. 출처·검색어는 조사 단계에서 온다.
 * 사업·직무 조사는 리포트의 뼈대라 실패하면 분석 실패(과금 없음)다. 경쟁사·경영진 쪽은 실패하면 두 칸만 빠진다.
 */
async function analyzeCompanyTwoStage(request, { fetcher, now, sleep, apiKey, reportDate, startedAt, deadlineAt }) {
  const researchCall = (topics, windowMs) => {
    const stageDeadlineAt = Math.min(deadlineAt, startedAt + windowMs);
    return callWithRetry(() => callGeminiGenerate({
      apiKey,
      fetcher,
      modelName: COMPANY_RESEARCH_MODEL,
      deadline: { deadlineAt: stageDeadlineAt, now, maxMs: windowMs },
      body: {
        contents: [{ role: "user", parts: [{ text: buildCompanyResearchPrompt(request, reportDate, topics) }] }],
        tools: [{ google_search: {} }],
        generationConfig: {
          thinkingConfig: { thinkingLevel: RESEARCH_THINKING_LEVEL },
        },
      },
    }), { deadlineAt: stageDeadlineAt, now, sleep, minRemainingMs: COMPANY_RESEARCH_RETRY_MIN_MS });
  };
  const composeCall = (memo, mode) => callWithRetry(() => callGeminiGenerate({
    apiKey,
    fetcher,
    modelName: COMPANY_COMPOSE_MODEL,
    deadline: { deadlineAt, now, maxMs: COMPANY_TOTAL_DEADLINE_MS },
    body: {
      contents: [{ role: "user", parts: [{ text: buildCompanyComposePrompt(request, reportDate, memo, { mode }) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingLevel: COMPOSE_THINKING_LEVEL },
      },
    },
  }), {
    deadlineAt,
    now,
    sleep,
    minRemainingMs: mode === "market" ? COMPANY_MARKET_COMPOSE_RETRY_MIN_MS : COMPANY_COMPOSE_RETRY_MIN_MS,
  });

  // 경쟁사·경영진 쪽은 절대 reject 하지 않는다(본 경로가 먼저 끝나거나 실패해도 처리되지 않은 거부가 남지 않게).
  const marketTask = (async () => {
    let research;
    try {
      research = await researchCall(COMPANY_RESEARCH_TOPIC_GROUPS.market, COMPANY_MARKET_RESEARCH_WINDOW_MS);
    } catch (error) {
      return { stages: [failedStageMeta("research-market", COMPANY_RESEARCH_MODEL, error)] };
    }
    const researchMeta = { ...researchStageMeta("research-market", research), ...withRetryFlag(research) };
    const text = joinCandidateText(research.data);
    if (text.trim().length === 0) return { research, stages: [researchMeta] };
    try {
      const composed = await composeCall(`## 경쟁사·경영진 메시지\n${text.trim()}`, "market");
      const parsed = parseModelJsonTolerant(joinCandidateText(composed.data));
      const sections = isRecord(parsed)
        ? {
          ...(isRecord(parsed.competitorComparison) ? { competitorComparison: parsed.competitorComparison } : {}),
          ...(isRecord(parsed.leadershipMessages) ? { leadershipMessages: parsed.leadershipMessages } : {}),
        }
        : {};
      return {
        research,
        composed,
        sections,
        stages: [researchMeta, { name: "compose-market", modelName: COMPANY_COMPOSE_MODEL, responseTimeMs: composed.responseTimeMs, ...withRetryFlag(composed) }],
      };
    } catch (error) {
      return { research, stages: [researchMeta, failedStageMeta("compose-market", COMPANY_COMPOSE_MODEL, error)] };
    }
  })();

  const [businessResult, roleResult] = await Promise.allSettled([
    researchCall(COMPANY_RESEARCH_TOPIC_GROUPS.business, COMPANY_RESEARCH_STAGE_TIMEOUT_MS),
    researchCall(COMPANY_RESEARCH_TOPIC_GROUPS.role, COMPANY_RESEARCH_STAGE_TIMEOUT_MS),
  ]);
  if (businessResult.status === "rejected") throw businessResult.reason;
  if (roleResult.status === "rejected") throw roleResult.reason;
  const business = businessResult.value;
  const role = roleResult.value;

  const memos = [
    ["사업·신사업·재무", joinCandidateText(business.data)],
    ["직무·이슈·인재상", joinCandidateText(role.data)],
  ].filter(([, text]) => text.trim().length > 0);
  if (memos.length === 0) throw new AnalysisModelFailureError("PARSE_ERROR");
  const memo = memos.map(([label, text]) => `## ${label}\n${text.trim()}`).join("\n\n");

  const compose = await composeCall(memo, "main");
  const parsed = parseModelJsonTolerant(joinCandidateText(compose.data));
  if (!isRecord(parsed)) throw new AnalysisModelFailureError("PARSE_ERROR");
  if (parsed.error === "CONTEXT_IRRELEVANT") return parsed;
  // 본 구성 메모에는 경쟁사·경영진 사실이 없다. 모델이 채웠더라도 근거 없는 칸이므로 버리고, 따로 만든 결과만 붙인다.
  delete parsed.competitorComparison;
  delete parsed.leadershipMessages;

  const market = await marketTask;
  const report = { ...parsed, ...(market.sections ?? {}) };
  const researchDatas = [business.data, role.data, market.research?.data].filter(Boolean);
  const sources = mergeGroundingSources(researchDatas);
  const grounding = mergeGroundingMeta(researchDatas);

  return finalizeCompanyReport(report, {
    reportDate,
    sources,
    grounding,
    request,
    repaired: false,
    analysisMeta: {
      modelName: `${COMPANY_RESEARCH_MODEL}+${COMPANY_COMPOSE_MODEL}`,
      responseTimeMs: now() - startedAt,
      httpStatus: compose.httpStatus,
      tokenUsage: [...researchDatas, compose.data, market.composed?.data].filter(Boolean).map(geminiUsage).reduce(sumUsage),
      pipeline: "two-stage",
      stages: [
        { ...researchStageMeta("research-business", business), ...withRetryFlag(business) },
        { ...researchStageMeta("research-role", role), ...withRetryFlag(role) },
        { name: "compose", modelName: COMPANY_COMPOSE_MODEL, responseTimeMs: compose.responseTimeMs, ...withRetryFlag(compose) },
        ...market.stages,
      ],
    },
  });
}

/** 기업 분석 핸들러가 자소서 핸들러(createAnalyzeHandler)에 주입하는 kind 조각. */
export const COMPANY_HANDLER_DEFAULTS = Object.freeze({
  analysisInput: companyAnalysisInput,
  buildProjectTitle: buildCompanyProjectTitle,
  creditsExhaustedCode: "COMPANY_CREDITS_EXHAUSTED",
  disabledCode: "COMPANY_ANALYSIS_DISABLED",
  getAnalysisThroughputPolicy: getCompanyAnalysisThroughputPolicy,
  hashRequest: companyRequestHash,
  // 전체 분석 스위치가 꺼지면 기업 분석도 함께 멈춘다.
  // 스위치가 꺼져 있어도 관리자는 생성할 수 있다(스펙 §4 M1: 관리자 지급 크레딧으로 내부 QA).
  isEnabled: (settings, user) =>
    settings?.analysisEnabled === true
    && (settings?.companyAnalysisEnabled === true || user?.role === "admin"),
  kind: "COMPANY",
  model: analyzeCompany,
  normalizeRequest: normalizeCompanyRequest,
  verifyRequest: verifyCompanyRequest,
});
