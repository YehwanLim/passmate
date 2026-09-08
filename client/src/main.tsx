import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import "./fonts/pretendard-variable-dynamic-subset.css";
import "./index.css";

// ──────────────────────────────────────────────────────────────
// GA4 초기화 (Production 전용)
// - VITE_GA_MEASUREMENT_ID 환경변수가 설정된 경우에만 삽입
// - 개발/테스트 환경에서는 아무것도 로드하지 않음
// ──────────────────────────────────────────────────────────────
const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

if (import.meta.env.PROD && GA_ID && GA_ID !== "G-XXXXXXXXXX") {
  // 1) dataLayer 초기화 및 gtag 설정
  //    CSP(script-src)가 인라인 스크립트를 차단하므로 번들 코드에서 직접 초기화한다.
  //    gtag.js는 배열이 아닌 arguments 객체를 기대하므로 function 선언으로 push한다.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, {
    send_page_view: true,
    cookie_flags: "SameSite=None;Secure",
  });

  // 2) gtag.js 외부 스크립트 삽입 (CSP script-src에 googletagmanager.com 허용됨)
  //    위의 gtag 스텁이 이벤트를 dataLayer에 쌓아 두므로 스크립트 자체는 첫 화면이 끝난 뒤 받아도 유실이 없다.
  //    170KB짜리 gtag.js가 폰트 조각·지연 청크와 대역폭을 다투지 않도록 load 이후 유휴 시간에 넣는다.
  const injectGtagScript = () => {
    const gtagScript = document.createElement("script");
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    gtagScript.async = true;
    document.head.appendChild(gtagScript);
  };
  const scheduleGtagScript = () => {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(injectGtagScript, { timeout: 3000 });
    } else {
      window.setTimeout(injectGtagScript, 1);
    }
  };
  if (document.readyState === "complete") {
    scheduleGtagScript();
  } else {
    window.addEventListener("load", scheduleGtagScript, { once: true });
  }
}

// 랜딩(`/`)은 빌드 때 프리렌더된 HTML(scripts/prerender-landing.mjs)로 오므로 하이드레이션하고,
// 다른 경로는 빈 껍데기(app.html)라 지금처럼 새로 그린다.
// `pnpm preview`처럼 모든 경로에 index.html을 주는 서버에서는 /analyze 에 랜딩 마크업이 실려 오는데,
// 그걸 하이드레이션하면 트리가 달라 React 가 경고하므로 비우고 새로 그린다.
const rootElement = document.getElementById("root")!;
const isPrerenderedLanding =
  rootElement.hasChildNodes() && window.location.pathname === "/";
if (isPrerenderedLanding) {
  hydrateRoot(rootElement, <App />);
} else {
  rootElement.replaceChildren();
  createRoot(rootElement).render(<App />);
}

