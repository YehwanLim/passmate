import { getAuthorizationHeader } from "@/lib/apiAuth";
import type { JobPostingSummary } from "@/types/jobPosting";
import type { ProjectSummary } from "@/types/my";

/**
 * 내 지원서(작업실)·내 경험 API 클라이언트.
 * 서버: api/projects.js, api/projects/[projectId]/index.js, lib/experiences.js(계정 라우터 /api/account/experiences).
 */
export type ApplicationQuestionDraft = {
  prompt: string;
  charLimit: number | null;
  answer: string;
  /** "이 초안으로 채우기" 때 고른 경험 id(최대 2). 서버가 본인 것만 남긴다 */
  draftExperienceIds?: string[];
};

export type ApplicationDetail = ProjectSummary & {
  deadline: string | null;
  posting_slug: string | null;
  latest_analysis_id: string | null;
  job_posting: { job_posting_id: string; source_url: string | null; summary: JobPostingSummary } | null;
  questions: Array<{
    position: number;
    prompt: string;
    char_limit: number | null;
    answer: string;
    draft_experience_ids?: string[];
  }>;
  questions_updated_at: string | null;
  /** 성공한 최신 분석. 있으면 글이 잠긴다(서버도 문항 저장을 409 APPLICATION_LOCKED 로 막는다). 구버전 응답엔 없다. */
  analyzed_report?: { analysis_id: string; analyzed_at: string; summary: string | null } | null;
};

export type Experience = {
  id: string;
  title: string;
  period: string | null;
  situation: string;
  action: string;
  result: string;
  /** 자유 양식 글. 비어 있으면 칸(상황·한 일·결과)으로 쓴 경험. 옛 응답엔 없을 수 있다. */
  body?: string;
  tags: string[];
  updatedAt: string;
};
export type ExperienceInput = Omit<Experience, "id" | "updatedAt">;

export type YearMonth = { year: number; month: number };
export type PeriodParts = { start: YearMonth | null; end: YearMonth | null; ongoing: boolean };
export const PERIOD_ONGOING = "진행 중";

const YM = String.raw`(\d{4})[./-](\d{1,2})\.?`;
const RANGE = new RegExp(`^${YM}\\s*[~\\-–]\\s*(?:${YM}|(${PERIOD_ONGOING}|현재))$`);
const SINGLE = new RegExp(`^${YM}$`);

function ym(year: string, month: string): YearMonth | null {
  const m = Number(month);
  return m >= 1 && m <= 12 ? { year: Number(year), month: m } : null;
}

/**
 * 경험 기간 글자를 연·월로 읽는다. "2024.03 ~ 2024.12", "2024.03 ~ 진행 중", "2024.3" 을 읽고,
 * 비었으면 빈 값, 알아볼 수 없는 옛 형식("2024 여름" 등)은 null.
 */
export function parsePeriod(period: string | null | undefined): PeriodParts | null {
  const text = (period ?? "").trim();
  if (!text) return { start: null, end: null, ongoing: false };
  const range = text.match(RANGE);
  if (range) {
    const start = ym(range[1], range[2]);
    if (!start) return null;
    if (range[5]) return { start, end: null, ongoing: true };
    const end = ym(range[3], range[4]);
    return end ? { start, end, ongoing: false } : null;
  }
  const single = text.match(SINGLE);
  if (single) {
    const start = ym(single[1], single[2]);
    return start ? { start, end: null, ongoing: false } : null;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const full = (v: YearMonth) => `${v.year}.${pad(v.month)}`;
const short = (v: YearMonth) => `${String(v.year).slice(2)}.${pad(v.month)}`;

/** 고른 연·월을 저장 형식으로: "2024.03 ~ 2024.12" · "2024.03 ~ 진행 중" · "2024.03". 시작이 없으면 null. */
export function buildPeriod(parts: PeriodParts): string | null {
  if (!parts.start) return null;
  if (parts.ongoing) return `${full(parts.start)} ~ ${PERIOD_ONGOING}`;
  if (parts.end) return `${full(parts.start)} ~ ${full(parts.end)}`;
  return full(parts.start);
}

/** 끝이 시작보다 앞서는가(저장 전 확인용). */
export function isPeriodReversed(parts: PeriodParts): boolean {
  if (!parts.start || !parts.end || parts.ongoing) return false;
  return parts.end.year * 12 + parts.end.month < parts.start.year * 12 + parts.start.month;
}

/**
 * 경험 기간을 목록용으로 짧게: "2024.07~2024.10" → "24.07 – 24.10", "2024.03 ~ 진행 중" → "24.03 – 진행 중".
 * 알아볼 수 없는 형식("2024 여름" 등)은 적힌 그대로, 비었으면 빈 문자열.
 */
export function formatPeriod(period: string | null | undefined): string {
  const text = (period ?? "").trim();
  if (!text) return "";
  const parts = parsePeriod(text);
  if (!parts?.start) return text;
  if (parts.ongoing) return `${short(parts.start)} – ${PERIOD_ONGOING}`;
  return parts.end ? `${short(parts.start)} – ${short(parts.end)}` : short(parts.start);
}

export class WorkspaceApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "WorkspaceApiError";
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(await getAuthorizationHeader()),
  };
  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") ?? "";
  const payload = type.includes("application/json") ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const code = payload && typeof payload.error === "string" ? payload.error : "REQUEST_FAILED";
    throw new WorkspaceApiError(code, response.status);
  }
  return payload as T;
}

export function createApplication(input: {
  company: string;
  jobKeyword?: string;
  deadline?: string | null;
  questions: ApplicationQuestionDraft[];
}): Promise<{ id: string }> {
  return request("/api/projects", { method: "POST", body: JSON.stringify(input) });
}

export function fetchApplication(id: string): Promise<ApplicationDetail> {
  return request(`/api/projects/${encodeURIComponent(id)}`);
}

export type ApplicationMeta = {
  id: string;
  title: string;
  company_name: string | null;
  job_role: string | null;
  deadline: string | null;
  job_posting_id?: string | null;
};

export function updateApplicationMeta(
  id: string,
  meta: { company?: string; jobKeyword?: string | null; deadline?: string | null; jobPostingId?: string | null }
): Promise<ApplicationMeta> {
  return request(`/api/projects/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(meta) });
}

export function saveApplicationQuestions(
  id: string,
  questions: ApplicationQuestionDraft[],
  baseUpdatedAt: string | null
): Promise<{ questions_updated_at: string | null }> {
  return request(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ questions, baseUpdatedAt }),
  });
}

export async function listExperiences(): Promise<Experience[]> {
  const { experiences } = await request<{ experiences: Experience[] }>("/api/account/experiences");
  return experiences;
}

export async function createExperience(input: ExperienceInput): Promise<Experience> {
  const { experience } = await request<{ experience: Experience }>("/api/account/experiences", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return experience;
}

/** 경험 자동 채우기에서 고른 후보를 한꺼번에(1~8개). 전부 저장되거나 하나도 안 된다. */
export async function createExperiences(inputs: ExperienceInput[]): Promise<Experience[]> {
  const { experiences } = await request<{ experiences: Experience[] }>("/api/account/experiences", {
    method: "POST",
    body: JSON.stringify({ experiences: inputs }),
  });
  return experiences;
}

export async function updateExperience(id: string, input: Partial<ExperienceInput>): Promise<Experience> {
  const { experience } = await request<{ experience: Experience }>(`/api/account/experiences/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return experience;
}

export async function deleteExperience(id: string): Promise<void> {
  await request(`/api/account/experiences/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function countChars(text: string): { withSpaces: number; withoutSpaces: number } {
  return { withSpaces: text.length, withoutSpaces: text.replace(/\s/g, "").length };
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function kstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);
}

/** 마감까지 남은 날(한국 날짜 기준). 오늘 마감 0, 지났으면 음수, 마감 없으면 null. */
/** "10월 8일" — 한국 시간 기준. 값이 없거나 깨졌으면 null. */
export function monthDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  const kst = new Date(time + 9 * 60 * 60 * 1000);
  return `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일`;
}

export function daysUntil(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return kstDayNumber(date) - kstDayNumber(now);
}

export type ApplicationStatus = "draft" | "analyzing" | "done";

/** 지원서 상태: 분석 전·실패는 작성 중, 접수된 분석은 분석 중, 끝났으면 분석 완료(구버전 응답은 상태가 없어 완료로 본다). */
export function applicationStatus(item: { latest_analysis_id?: string | null; latest_status?: string | null }): ApplicationStatus {
  if (!item.latest_analysis_id || item.latest_status === "FAILED") return "draft";
  if (item.latest_status === "PENDING") return "analyzing";
  return "done";
}

/**
 * 내 지원서 순서: 작성 중(마감 가까운 순 → 마감 없음은 최근 수정순) → 분석 중·완료(같은 규칙) → 마감 지난 것(최근 마감순).
 * 지금 손댈 것이 위로 오게 한다.
 */
export function sortApplications<
  T extends { deadline?: string | null; updated_at?: string; created_at: string; latest_analysis_id?: string | null; latest_status?: string | null },
>(items: T[], now: Date = new Date()): T[] {
  const time = (value: string | undefined | null) => (value ? new Date(value).getTime() : 0);
  const passed = (item: T) => Boolean(item.deadline) && new Date(item.deadline as string).getTime() < now.getTime();
  const rank = (item: T) => (passed(item) ? 2 : applicationStatus(item) === "draft" ? 0 : 1);
  return [...items].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 2) return time(b.deadline) - time(a.deadline);
    if (Boolean(a.deadline) !== Boolean(b.deadline)) return a.deadline ? -1 : 1;
    if (a.deadline && b.deadline) return time(a.deadline) - time(b.deadline);
    return time(b.updated_at ?? b.created_at) - time(a.updated_at ?? a.created_at);
  });
}
