import { APPLICATION_BOARD_COPY } from "@/copy/applicationBoardCopy";
import { baseStage, currentStep, resolveSteps, type StageFields } from "@/lib/applicationStages";
import { GUIDE_SUMMARIES, guidePath } from "@/lib/guideSummaries";

/**
 * 지원서 한 장의 "지금 할 일"(설계 3.4절 표). 단계는 이 행동을 고르는 신호다.
 * 가이드는 본문 없는 GUIDE_SUMMARIES 를 쓴다(lib/guides.ts 는 본문을 통째로 실어 /my 번들이 무거워진다).
 */
export type NextActionKind = "guide-questions" | "write" | "continue" | "diagnose" | "report" | "prepare" | "interview" | "paste";
export type NextAction = {
  kind: NextActionKind;
  label: string;
  reason: string;
  href: string;
  track: string;
  secondary?: { label: string; href: string };
};
export type GuideRef = { slug: string; company: string | null; category: string };
export type NextActionInput = StageFields & {
  id: string;
  company_name: string | null;
  answered_count?: number;
  latest_analysis_id?: string | null;
  latest_status?: string | null;
};

const INTERVIEW_CATEGORY = "면접 후기";
const companyKey = (name: string | null | undefined) => (name ?? "").replace(/\s+/g, "").toLowerCase();

/** 회사 이름이 정확히 같은 글만. 애매하면 링크를 숨긴다(틀린 연결보다 안 뜨는 쪽). */
function findGuide(company: string | null, guides: readonly GuideRef[], interview: boolean): GuideRef | undefined {
  const key = companyKey(company);
  if (!key) return undefined;
  return guides.find((g) => companyKey(g.company) === key && (g.category === INTERVIEW_CATEGORY) === interview);
}

export function nextAction(p: NextActionInput, guides: readonly GuideRef[] = GUIDE_SUMMARIES): NextAction | null {
  if (p.rejected || p.stage === "offer") return null;
  const steps = resolveSteps(p.stage_steps);
  const stage = baseStage(steps, currentStep(p).key);
  const copy = APPLICATION_BOARD_COPY.next;
  const workspace = `/my/${encodeURIComponent(p.id)}`;
  const interviewHref = `/my/interview-practice?application=${encodeURIComponent(p.id)}`;
  const hasText = (p.answered_count ?? 0) > 0 || Boolean(p.latest_analysis_id);
  const make = (kind: NextActionKind, text: { label: string; reason: string }, href: string): NextAction => ({
    kind, label: text.label, reason: text.reason, href, track: `next-action:${stage}:${kind}`,
  });

  if (stage === "interest") {
    const guide = findGuide(p.company_name, guides, false);
    return guide ? make("guide-questions", copy.guideQuestions, guidePath(guide)) : make("write", copy.write, workspace);
  }
  if (stage === "writing") {
    if (p.latest_analysis_id && p.latest_status === "SUCCESS") {
      return make("report", copy.report, `/report-new?analysisId=${encodeURIComponent(p.latest_analysis_id)}`);
    }
    return (p.answered_count ?? 0) > 0 ? make("diagnose", copy.diagnose, workspace) : make("continue", copy.continue, workspace);
  }
  if (stage === "submitted") {
    return hasText ? make("prepare", copy.prepare, interviewHref) : make("paste", copy.paste, workspace);
  }
  // doc_passed · interview
  const action = hasText ? make("interview", copy.interview, interviewHref) : make("paste", copy.paste, workspace);
  const guide = findGuide(p.company_name, guides, true);
  return guide ? { ...action, secondary: { label: copy.interviewGuide, href: guidePath(guide) } } : action;
}
