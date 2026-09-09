import { startTransition } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { applyFullStylesheet } from "./applyFullStylesheet";
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
  // 프로덕션에서는 public/landing-boot.js 가 이 모듈의 평가 자체를 첫 프레임 뒤로 미룬다. 여기서는 한 프레임을
  // 더 양보한 뒤(rAF → 다음 태스크) 하이드레이션해, 모듈이 첫 페인트 전에 실행되는 환경(pnpm preview 등)에서도
  // 프리렌더한 HTML 이 먼저 보이게 한다. 전체 CSS 는 preload 만 걸려 있어(첫 화면 CSS 는 HTML 에 인라인)
  // JS 뒤에 생기는 UI 를 위해 여기서 적용한다.
  // startTransition: 하이드레이션을 잘게 나눠 브라우저에 양보한다. WebKit 은 타일을 메인 스레드에서 그리므로
  // 통째로 하이드레이션하면 그동안 스크롤한 영역이 빈 채로 남는다(폰에서 "아래가 텅 빈" 증상).
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      applyFullStylesheet();
      startTransition(() => {
        hydrateRoot(rootElement, <App />);
      });
    }, 0);
  });
} else {
  applyFullStylesheet();
  rootElement.replaceChildren();
  createRoot(rootElement).render(<App />);
}

