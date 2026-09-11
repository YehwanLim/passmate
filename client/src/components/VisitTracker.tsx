import { useEffect } from "react";
import { useLocation } from "wouter";

import { trackPageView } from "@/lib/analytics";
import { sendVisit, shouldTrackPath } from "@/lib/siteVisits";

// 같은 경로를 짧은 간격으로 두 번 보내지 않는 최소 간격(개발 StrictMode 이중 실행 등).
const MIN_RESEND_MS = 60 * 1000;
// 한 페이지에 오래 머무는 사용자(자소서 작성 중 등)가 "현재 온라인"(30분 창)에서 빠지지 않게
// 탭이 보이는 동안 주기적으로 다시 알린다.
const HEARTBEAT_MS = 5 * 60 * 1000;
// 로컬 dev 서버도 같은 DB 를 보므로, GA(main.tsx)와 같이 프로덕션 빌드에서만 보낸다.
// 아니면 개발 중 열어 본 페이지가 관리자 대시보드에 방문으로 잡힌다.
const TRACKING_ENABLED = import.meta.env.PROD;

// 모듈 스코프에 둔다. 컴포넌트 ref 였을 때는 하이드레이션 복구 등으로 트리가 다시 마운트될 때마다
// 초기화돼, 랜딩 한 번 로드에 /api/visits 가 여러 번 나갔다(09-12 프로덕션에서 6회 관찰).
let lastSent: { path: string; at: number } | null = null;
// GA page_view 를 마지막으로 보낸 경로. null 이면 첫 화면이라 gtag config(main.tsx)가 이미 보냈다.
let lastPageViewPath: string | null = null;

/** 테스트에서 모듈 상태를 초기화하기 위한 훅. 프로덕션 코드는 호출하지 않는다. */
export function resetVisitTrackerForTests(): void {
  lastSent = null;
  lastPageViewPath = null;
}

/**
 * 라우트가 바뀔 때마다 방문 핑과 GA page_view 를 보낸다. 화면을 그리지 않는다.
 * 실패는 조용히 무시되므로 사용자 흐름에는 영향이 없다.
 */
export function VisitTracker({ enabled = TRACKING_ENABLED }: { enabled?: boolean } = {}) {
  const [location] = useLocation();

  useEffect(() => {
    if (!enabled || !shouldTrackPath(location)) return;

    // SPA 전환은 gtag 가 스스로 page_view 를 보내지 않는다. 이게 없으면 /login 도달률을 볼 수 없다.
    if (lastPageViewPath === null) {
      lastPageViewPath = location;
    } else if (lastPageViewPath !== location) {
      lastPageViewPath = location;
      trackPageView(location);
    }

    const send = () => {
      lastSent = { path: location, at: Date.now() };
      void sendVisit(location);
    };

    const recent = lastSent;
    if (!(recent && recent.path === location && Date.now() - recent.at < MIN_RESEND_MS)) send();

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") send();
    }, HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - (lastSent?.at ?? 0) >= HEARTBEAT_MS) send();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, location]);

  return null;
}
