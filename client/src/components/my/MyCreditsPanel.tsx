import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.credits;

/**
 * 마이페이지 머리말 오른쪽의 남은 이용권 칸(10-08 개편: 왼쪽 칸 두 개를 없애고 지원서·경험에 자리를 준다).
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

  // 칸 전체가 내 이용권 화면으로 가는 버튼. 불러오는 중·실패해도 칸 모양은 유지한다.
  return (
    <button
      type="button"
      onClick={() => navigate("/my/entitlements")}
      aria-live="polite"
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-line-soft bg-surface px-4 py-3 text-left transition-colors hover:border-line sm:w-auto sm:min-w-[260px]"
    >
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold text-ink-4">{COPY.heading}</span>
        {failed ? (
          <span className="mt-0.5 block text-[13px] text-ink-4">{COPY.error}</span>
        ) : summary ? (
          <>
            <span className="mt-0.5 block text-[15px] font-bold text-ink">
              {COPY.compactLine(summary.remaining, summary.companyAnalysisEnabled ? summary.companyRemaining : null)}
            </span>
            {summary.freeRemaining > 0 && <span className="mt-0.5 block text-[12.5px] font-semibold text-brand-ink">{COPY.freeLeft}</span>}
          </>
        ) : (
          <span className="mt-1.5 block h-4 w-36 animate-pulse rounded bg-fill" aria-hidden="true" />
        )}
      </span>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-semibold text-brand-ink">
        {COPY.buyShort}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}
