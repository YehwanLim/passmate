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
};

export type Experience = {
  id: string;
  title: string;
  period: string | null;
  situation: string;
  action: string;
  result: string;
  tags: string[];
  updatedAt: string;
};
export type ExperienceInput = Omit<Experience, "id" | "updatedAt">;

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
export function daysUntil(deadline: string | null, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  return kstDayNumber(date) - kstDayNumber(now);
}

/** 현황판 순서: 다가오는 마감(가까운 순) → 마감 없음(최근 수정순) → 지난 마감(최근 마감순). */
export function sortApplications<T extends { deadline?: string | null; updated_at?: string; created_at: string }>(
  items: T[],
  now: Date = new Date()
): T[] {
  const time = (value: string | undefined | null) => (value ? new Date(value).getTime() : 0);
  const group = (item: T) => {
    if (!item.deadline) return 1;
    return new Date(item.deadline).getTime() >= now.getTime() ? 0 : 2;
  };
  return [...items].sort((a, b) => {
    const ga = group(a);
    const gb = group(b);
    if (ga !== gb) return ga - gb;
    if (ga === 0) return time(a.deadline) - time(b.deadline);
    if (ga === 2) return time(b.deadline) - time(a.deadline);
    return time(b.updated_at ?? b.created_at) - time(a.updated_at ?? a.created_at);
  });
}
