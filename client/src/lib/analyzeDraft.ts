// 분석 폼 초안의 로그인 왕복 보관소.
// 카카오 로그인은 페이지를 떠났다 돌아오므로(Supabase OAuth 리다이렉트) 메모리의 폼이 사라진다.
// 떠나기 직전에 sessionStorage 에 넣고, /analyze 가 다시 마운트될 때 한 번 꺼내 쓰고 지운다.
// sessionStorage 라 탭을 닫으면 사라지고, 다른 탭·기기와 공유되지 않는다.
// 키는 passmate_ 접두사라 로그아웃 시 clearPassMateStorage 가 같이 지운다.
import type { QuestionItem } from "@/pages/analyzeQuestions";
import type { JobPostingRecord } from "@/types/jobPosting";

export const ANALYZE_DRAFT_KEY = "passmate_analyze_draft";
/** 로그인 왕복에 충분한 시간. 그 뒤엔 오래된 초안이 새 방문을 덮지 않도록 버린다. */
export const ANALYZE_DRAFT_TTL_MS = 30 * 60 * 1000;

export interface AnalyzeDraft {
  company: string;
  jobRole: string;
  questions: QuestionItem[];
  jobPosting: JobPostingRecord | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQuestionItem(value: unknown): value is QuestionItem {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.question === "string" &&
    typeof value.answer === "string"
  );
}

function isJobPostingRecord(value: unknown): value is JobPostingRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isRecord(value.summary)
  );
}

function parseDraft(raw: string): AnalyzeDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.savedAt !== "number") return null;
  if (Date.now() - parsed.savedAt > ANALYZE_DRAFT_TTL_MS) return null;
  if (typeof parsed.company !== "string" || typeof parsed.jobRole !== "string") {
    return null;
  }
  if (!Array.isArray(parsed.questions)) return null;

  return {
    company: parsed.company,
    jobRole: parsed.jobRole,
    questions: parsed.questions.filter(isQuestionItem),
    jobPosting: isJobPostingRecord(parsed.jobPosting) ? parsed.jobPosting : null,
  };
}

export function saveAnalyzeDraft(draft: AnalyzeDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      ANALYZE_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
  } catch {
    // 저장소가 막힌 브라우저(사생활 보호 모드 등)에서는 초안 없이 진행한다.
  }
}

/** 저장된 초안을 꺼내고 지운다. 없거나 오래됐거나 깨졌으면 null. */
export function takeAnalyzeDraft(): AnalyzeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ANALYZE_DRAFT_KEY);
    if (raw === null) return null;
    window.sessionStorage.removeItem(ANALYZE_DRAFT_KEY);
    return parseDraft(raw);
  } catch {
    return null;
  }
}
