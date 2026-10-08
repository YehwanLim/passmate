import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.credits;

/**
 * 마이페이지 머리말 오른쪽의 남은 이용권 한 줄(10-08 개편: 왼쪽 칸 두 개를 없애고 지원서·경험에 자리를 준다).
 * 계정 이메일은 프로필 메뉴에 있으니 여기선 뺀다. 상세·구매는 이용권 화면으로.
 */
export default function MyCreditsPanel() {
  const [, navigate] = useLocation();
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const next = await fetchEntitlementSummary(session.access_token);
        if (alive) setSummary(next);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-3" aria-live="polite">
      {failed ? (
        <span className="text-[13px] text-ink-4">{COPY.error}</span>
      ) : summary ? (
        <span>
          {COPY.heading}{" "}
          <b className="font-bold text-ink">
            {COPY.compactLine(summary.remaining, summary.companyAnalysisEnabled ? summary.companyRemaining : null)}
          </b>
          {summary.freeRemaining > 0 && <span className="ml-2 text-[13px] font-semibold text-brand-ink">{COPY.freeLeft}</span>}
        </span>
      ) : (
        <span className="h-4 w-40 animate-pulse rounded bg-fill" aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={() => navigate("/my/entitlements")}
        className="inline-flex items-center gap-0.5 font-semibold text-brand-ink hover:underline underline-offset-4"
      >
        {COPY.buyShort}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
