import { useEffect, useState } from "react";
import { fetchEntitlementSummary, type EntitlementSummary } from "@/lib/entitlements";

/**
 * 남은 이용권 요약. 마이페이지 머리말과 프로필 메뉴가 같이 쓴다.
 * enabled 가 false 면 부르지 않는다(프로필 메뉴는 열 때마다 새로 읽는다). 세션이 없으면 조용히 비워 둔다.
 * supabase 는 동적으로 부른다 — 헤더(프로필 메뉴)가 랜딩에도 있어서 정적 import 면 진입 청크에 합쳐진다(AuthContext 와 같은 이유).
 */
export function useCreditSummary(enabled = true): { summary: EntitlementSummary | null; failed: boolean } {
  const [summary, setSummary] = useState<EntitlementSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setFailed(false);
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const next = await fetchEntitlementSummary(session.access_token);
        if (alive) setSummary(next);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [enabled]);

  return { summary, failed };
}
