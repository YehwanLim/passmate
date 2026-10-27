import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useCreditSummary } from "@/hooks/useCreditSummary";
import { WORKSPACE_COPY } from "@/copy/workspaceCopy";

const COPY = WORKSPACE_COPY.credits;

/**
 * 마이페이지 머리말 오른쪽 위의 남은 이용권 띠(10-08 C안을 오른쪽에 아주 작게).
 * 한 줄짜리 얇은 띠라 제목보다 앞에 나서지 않는다. 띠 전체가 내 이용권 화면으로 가는 버튼.
 * 지금 보는 칸에서 쓰는 이용권 하나만 보인다(10-09): 자기소개서 → 자소서 진단, 기업 리포트 → 기업 분석.
 */
export default function MyCreditsPanel({ kind }: { kind: "essay" | "company" }) {
  const [, navigate] = useLocation();
  const { summary, failed } = useCreditSummary();

  // 기업 분석이 꺼져 있으면 기업 리포트 칸에서는 띠를 아예 두지 않는다.
  if (kind === "company" && summary && !summary.companyAnalysisEnabled) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/my/entitlements")}
      aria-live="polite"
      className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-[10px] bg-surface px-3 py-1.5 text-left text-[12.5px] text-ink-3 transition-colors hover:bg-fill-soft"
    >
      <span className="text-ink-4">{COPY.heading}</span>
      {failed ? (
        <span className="text-ink-4">{COPY.error}</span>
      ) : summary ? (
        <>
          <b className="font-bold text-ink">
            {kind === "essay" ? COPY.essayLine(summary.remaining) : COPY.companyLine(summary.companyRemaining)}
          </b>
          {kind === "essay" && summary.freeRemaining > 0 && <span className="font-semibold text-brand-ink">{COPY.freeShort}</span>}
        </>
      ) : (
        <span className="h-3 w-28 animate-pulse rounded bg-fill" aria-hidden="true" />
      )}
      <span className="inline-flex items-center font-semibold text-brand-ink">
        {COPY.buyShort}
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
      </span>
    </button>
  );
}
