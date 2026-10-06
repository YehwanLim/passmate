import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.credits;
const card = "rounded-[20px] bg-surface p-[22px]";

/** 마이페이지 왼쪽 칸: 계정과 남은 이용권. 상세·구매는 기존 화면으로 보낸다. */
export default function MyCreditsPanel({ email }: { email: string | null }) {
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
    <>
    {/* 폰: 칸 두 개가 탭을 한참 밀어내지 않도록 남은 횟수만 한 줄로. 불러오기 전·실패 시엔 비워 둔다 */}
    {summary && !failed && (
      <div className="flex items-center justify-between gap-3 rounded-[20px] bg-surface py-3.5 pl-5 pr-3.5 lg:hidden">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-ink-4">{COPY.heading}</p>
          <p className="mt-0.5 truncate text-[15px] font-bold text-ink">
            {COPY.compactLine(summary.remaining, summary.companyAnalysisEnabled ? summary.companyRemaining : null)}
          </p>
        </div>
        {/* 넓은 화면의 "이용권 사기" 버튼과 같은 표면 — 글자만 덩그러니 있으면 누르는 곳으로 안 읽힌다 */}
        <button
          type="button"
          onClick={() => navigate("/entitlements")}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-[10px] bg-fill px-3.5 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-line"
        >
          {COPY.buy}
          <ChevronRight className="h-3.5 w-3.5 text-ink-4" aria-hidden="true" />
        </button>
      </div>
    )}
    <aside className="hidden space-y-4 lg:block">
      <section className={card}>
        <p className="text-[14px] font-semibold text-ink-4">{COPY.account}</p>
        {email && <p className="mt-1 truncate text-[15px] text-ink-2">{email}</p>}
      </section>
      <section className={card} aria-live="polite">
        <p className="mb-3 text-[14px] font-semibold text-ink-4">{COPY.heading}</p>
        {failed ? (
          <p className="text-[13px] text-ink-4">{COPY.error}</p>
        ) : summary ? (
          <>
            <div className="flex items-baseline justify-between py-1.5 text-[15px] text-ink-2">
              <span>{COPY.essay}</span>
              <span className="text-[22px] font-extrabold text-ink">{COPY.count(summary.remaining)}</span>
            </div>
            {summary.companyAnalysisEnabled && (
              <div className="flex items-baseline justify-between py-1.5 text-[15px] text-ink-2">
                <span>{COPY.company}</span>
                <span className="text-[22px] font-extrabold text-ink">{COPY.count(summary.companyRemaining)}</span>
              </div>
            )}
            {summary.freeRemaining > 0 && <p className="mt-2 text-[13px] font-semibold text-brand-ink">{COPY.freeLeft}</p>}
          </>
        ) : (
          <div className="h-16 animate-pulse rounded-lg bg-fill" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => navigate("/entitlements")}
          className="mt-4 h-11 w-full rounded-xl bg-fill text-[15px] font-bold text-ink-2 transition-colors hover:bg-line"
        >
          {COPY.buy}
        </button>
        <button type="button" onClick={() => navigate("/my/entitlements")} className="mt-2.5 w-full text-center text-[13px] text-ink-4 hover:text-ink-2">
          {COPY.detail}
        </button>
      </section>
    </aside>
    </>
  );
}
