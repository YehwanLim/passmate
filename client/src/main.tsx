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
  // 1) gtag.js 외부 스크립트 삽입
  const gtagScript = document.createElement("script");
  gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  gtagScript.async = true;
  document.head.appendChild(gtagScript);

  // 2) dataLayer 초기화 및 gtag 설정
  const inlineScript = document.createElement("script");
  inlineScript.textContent = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){ dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', '${GA_ID}', {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });
  `;
  document.head.appendChild(inlineScript);
}

createRoot(document.getElementById("root")!).render(<App />);

