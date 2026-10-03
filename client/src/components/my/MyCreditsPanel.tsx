import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";
import { supabase } from "@/lib/supabase";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.credits;
const card = "rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5";

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
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 lg:hidden">
        <p className="min-w-0 truncate text-[13px] text-zinc-300">
          {COPY.compactLine(summary.remaining, summary.companyAnalysisEnabled ? summary.companyRemaining : null)}
        </p>
        <button type="button" onClick={() => navigate("/entitlements")} className="shrink-0 text-[13px] font-semibold text-zinc-100 hover:text-white">
          {COPY.buy}
        </button>
      </div>
    )}
    <aside className="hidden space-y-4 lg:block">
      <section className={card}>
        <p className="text-[13px] text-zinc-500">{COPY.account}</p>
        {email && <p className="mt-1 truncate text-sm text-zinc-200">{email}</p>}
      </section>
      <section className={card} aria-live="polite">
        <p className="mb-3 text-[13px] text-zinc-500">{COPY.heading}</p>
        {failed ? (
          <p className="text-[13px] text-zinc-500">{COPY.error}</p>
        ) : summary ? (
          <>
            <div className="flex items-center justify-between py-1.5 text-sm text-zinc-200">
              <span>{COPY.essay}</span>
              <span className="font-semibold">{COPY.count(summary.remaining)}</span>
            </div>
            {summary.companyAnalysisEnabled && (
              <div className="flex items-center justify-between border-t border-white/[0.06] py-1.5 text-sm text-zinc-200">
                <span>{COPY.company}</span>
                <span className="font-semibold">{COPY.count(summary.companyRemaining)}</span>
              </div>
            )}
            {summary.freeRemaining > 0 && <p className="mt-2 text-[12px] text-zinc-500">{COPY.freeLeft}</p>}
          </>
        ) : (
          <div className="h-16 animate-pulse rounded-lg bg-white/[0.03]" aria-hidden="true" />
        )}
        <button
          type="button"
          onClick={() => navigate("/entitlements")}
          className="mt-4 h-10 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 hover:bg-white/[0.1]"
        >
          {COPY.buy}
        </button>
        <button type="button" onClick={() => navigate("/my/entitlements")} className="mt-2 w-full text-center text-[12px] text-zinc-500 hover:text-zinc-300">
          {COPY.detail}
        </button>
      </section>
    </aside>
    </>
  );
}
