import { createRoot } from "react-dom/client";
import App from "./App";
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
  const gtagScript = document.createElement("script");
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  gtagScript.async = true;
  document.head.appendChild(gtagScript);
}

createRoot(document.getElementById("root")!).render(<App />);

