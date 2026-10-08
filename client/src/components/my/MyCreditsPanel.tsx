import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useCreditSummary } from "@/hooks/useCreditSummary";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.credits;

/**
 * 마이페이지 머리말 오른쪽 위의 남은 이용권 띠(10-08 C안을 오른쪽에 아주 작게).
 * 한 줄짜리 얇은 띠라 제목·탭보다 앞에 나서지 않는다. 띠 전체가 내 이용권 화면으로 가는 버튼.
 */
export default function MyCreditsPanel() {
  const [, navigate] = useLocation();
  const { summary, failed } = useCreditSummary();

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
            {COPY.compactLine(summary.remaining, summary.companyAnalysisEnabled ? summary.companyRemaining : null)}
          </b>
          {summary.freeRemaining > 0 && <span className="font-semibold text-brand-ink">{COPY.freeShort}</span>}
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
