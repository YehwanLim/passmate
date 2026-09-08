import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

import { sendVisit, shouldTrackPath } from "@/lib/siteVisits";

// 같은 경로를 짧은 간격으로 두 번 보내지 않는 최소 간격(개발 StrictMode 이중 실행 등).
const MIN_RESEND_MS = 60 * 1000;
// 한 페이지에 오래 머무는 사용자(자소서 작성 중 등)가 "현재 온라인"(30분 창)에서 빠지지 않게
// 탭이 보이는 동안 주기적으로 다시 알린다.
const HEARTBEAT_MS = 5 * 60 * 1000;
// 로컬 dev 서버도 같은 DB 를 보므로, GA(main.tsx)와 같이 프로덕션 빌드에서만 보낸다.
// 아니면 개발 중 열어 본 페이지가 관리자 대시보드에 방문으로 잡힌다.
const TRACKING_ENABLED = import.meta.env.PROD;

/**
 * 라우트가 바뀔 때마다 방문 핑을 보낸다. 화면을 그리지 않는다.
 * 실패는 조용히 무시되므로 사용자 흐름에는 영향이 없다.
 */
export function VisitTracker() {
  const [location] = useLocation();
  const lastSent = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    if (!TRACKING_ENABLED || !shouldTrackPath(location)) return;

    const send = () => {
      lastSent.current = { path: location, at: Date.now() };
      void sendVisit(location);
    };

    const recent = lastSent.current;
    if (!(recent && recent.path === location && Date.now() - recent.at < MIN_RESEND_MS)) send();

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") send();
    }, HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - (lastSent.current?.at ?? 0) >= HEARTBEAT_MS) send();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [location]);

  return null;
}
