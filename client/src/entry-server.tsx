import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "./App";

/**
 * 빌드 시점 프리렌더 진입점 (scripts/prerender-landing.mjs 가 사용).
 *
 * 랜딩(`/`)만 HTML로 미리 그려 JS 실행 전에 첫 화면이 보이게 한다.
 * 클라이언트(main.tsx)는 Router 없이 <App />을 하이드레이션하므로 여기서 감싸는
 * Router 는 DOM 을 만들지 않는 SSR 경로 지정용이다.
 * 설계: docs/superpowers/specs/2026-09-08-랜딩-프리렌더-design.md
 */
export function render(path: string): string {
  return renderToString(
    <Router ssrPath={path}>
      <App />
    </Router>
  );
}
