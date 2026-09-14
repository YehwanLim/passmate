import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "./App";

/**
 * 빌드 시점 프리렌더 진입점 (scripts/prerender-landing.mjs 가 사용).
 *
 * 랜딩(`/`)과 공개 예시 리포트(`/report-new?sample=1`)를 HTML로 미리 그려 JS 실행 전에 첫 화면이 보이게 한다.
 * 여기서 감싸는 Router 는 DOM 을 만들지 않는 SSR 경로 지정용이다. 클라이언트(main.tsx)도 하이드레이션 때
 * 같은 모양으로 ssrPath·ssrSearch 를 넘겨 첫 패스의 경로·검색어 스냅샷을 서버와 맞춘다.
 * 설계: docs/superpowers/specs/2026-09-08-랜딩-프리렌더-design.md
 */
export function render(path: string): string {
  return renderToString(
    <Router ssrPath={path}>
      <App />
    </Router>
  );
}

// renderToString 은 기다리지 않는다: lazy 페이지가 아직 안 왔으면 Suspense 폴백을 이 표식과 함께 내보내고
// 클라이언트에 다시 그리라고 넘긴다. 그 HTML 을 배포하면 빈 화면이 되므로 페이지 모듈이 준비될 때까지 다시 렌더한다.
const CLIENT_RENDER_MARKER = "<!--$!-->";

/** App 의 라우트 그대로(lazy 페이지 포함) 한 경로를 렌더한다. 클라이언트가 하이드레이션할 트리와 같은 모양이다. */
export async function renderRoute(path: string, search = ""): Promise<string> {
  const tree = (
    <Router ssrPath={path} ssrSearch={search}>
      <App />
    </Router>
  );
  let html = renderToString(tree);
  for (let attempt = 0; html.includes(CLIENT_RENDER_MARKER) && attempt < 40; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 25));
    html = renderToString(tree);
  }
  if (html.includes(CLIENT_RENDER_MARKER)) {
    throw new Error(`route ${path}?${search} still has a suspended boundary after waiting for its page module`);
  }
  return html;
}

export const SAMPLE_REPORT_ROUTE = { path: "/report-new", search: "sample=1" } as const;

/** 공개 예시 리포트(ReportResult 의 ?sample=1). 로그인·fetch 없이 상수만 그리므로 빌드 때 굳힐 수 있다. */
export function renderSampleReport(): Promise<string> {
  return renderRoute(SAMPLE_REPORT_ROUTE.path, SAMPLE_REPORT_ROUTE.search);
}
