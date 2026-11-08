// 리포트 없이 시작하는 AI 모의 면접의 입력(회사·직무·자소서)을 소개 화면 → 시작 화면으로 넘긴다.
// 자소서는 주소에 싣기엔 길고 민감해서 같은 탭의 sessionStorage 에만 둔다(로그인 화면을 거쳐 돌아와도 남는다).
import type { ApplicationDetail } from "@/lib/workspace";
import { INTERVIEW_DIRECT_LIMITS, type InterviewDirectSource } from "./interviewApi";

const KEY = "preview:interview-direct-draft";

export function saveInterviewDirectDraft(draft: InterviewDirectSource) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 저장이 막힌 브라우저에서는 시작 화면이 소개 화면으로 돌려보낸다.
  }
}

export function loadInterviewDirectDraft(): InterviewDirectSource | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<InterviewDirectSource>;
    if (typeof value.company !== "string" || typeof value.jobRole !== "string" || typeof value.coverLetter !== "string") return null;
    return { company: value.company, jobRole: value.jobRole, coverLetter: value.coverLetter };
  } catch {
    return null;
  }
}

/**
 * 저장한 지원서(작업실 문항·답변)를 면접 입력으로 바꾼다. 답을 쓴 문항만 "[문항 N] 질문 + 답" 으로 이어 붙인다.
 * 쓴 답이 하나도 없으면 null.
 */
export function directSourceFromApplication(detail: Pick<ApplicationDetail, "company_name" | "job_role" | "questions">): InterviewDirectSource | null {
  const answered = [...(detail.questions ?? [])]
    .sort((a, b) => a.position - b.position)
    .filter((question) => question.answer.trim());
  if (answered.length === 0) return null;
  const coverLetter = answered
    .map((question, index) => `[문항 ${index + 1}] ${question.prompt.trim()}\n${question.answer.trim()}`)
    .join("\n\n")
    .slice(0, INTERVIEW_DIRECT_LIMITS.coverLetterMax);
  return {
    company: (detail.company_name ?? "").slice(0, INTERVIEW_DIRECT_LIMITS.companyMax),
    jobRole: (detail.job_role ?? "").slice(0, INTERVIEW_DIRECT_LIMITS.jobRoleMax),
    coverLetter,
  };
}
