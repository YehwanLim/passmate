// 리포트 없이 시작하는 AI 모의 면접의 입력(회사·직무·자소서)을 소개 화면 → 시작 화면으로 넘긴다.
// 자소서는 주소에 싣기엔 길고 민감해서 같은 탭의 sessionStorage 에만 둔다(로그인 화면을 거쳐 돌아와도 남는다).
import { parseAnalysisSections } from "@/lib/analysisSections";
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
function joinSections(sections: Array<{ question: string; answer: string }>): string | null {
  const answered = sections.filter((section) => section.answer.trim());
  if (answered.length === 0) return null;
  return answered
    .map((section, index) => `[문항 ${index + 1}] ${section.question.trim()}\n${section.answer.trim()}`)
    .join("\n\n")
    .slice(0, INTERVIEW_DIRECT_LIMITS.coverLetterMax);
}

export function directSourceFromApplication(detail: Pick<ApplicationDetail, "company_name" | "job_role" | "questions">): InterviewDirectSource | null {
  const coverLetter = joinSections(
    [...(detail.questions ?? [])].sort((a, b) => a.position - b.position).map((question) => ({ question: question.prompt, answer: question.answer })),
  );
  if (!coverLetter) return null;
  return {
    company: (detail.company_name ?? "").slice(0, INTERVIEW_DIRECT_LIMITS.companyMax),
    jobRole: (detail.job_role ?? "").slice(0, INTERVIEW_DIRECT_LIMITS.jobRoleMax),
    coverLetter,
  };
}

/**
 * 분석 화면(/analyze)에서 바로 분석한 지원서는 작업실 문항이 비어 있고 글이 분석 기록(GET /api/analysis/:id)에만 있다.
 * 그 question_text·input_text 를 같은 모양으로 바꾼다.
 */
export function directSourceFromAnalysis(analysis: { company_name?: string | null; job_role?: string | null; question_text?: string | null; input_text?: string | null }): InterviewDirectSource | null {
  const coverLetter = joinSections(parseAnalysisSections(analysis.question_text ?? "", analysis.input_text ?? ""));
  if (!coverLetter) return null;
  return {
    company: (analysis.company_name ?? "").slice(0, INTERVIEW_DIRECT_LIMITS.companyMax),
    jobRole: (analysis.job_role ?? "").slice(0, INTERVIEW_DIRECT_LIMITS.jobRoleMax),
    coverLetter,
  };
}
