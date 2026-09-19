import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "./App";

import { seedGuideHtml } from "./lib/guideBodies";
import { GUIDES, guideMeta, guidePath, guidePrerenderRoute, renderGuideHtml } from "./lib/guides";
import { absoluteUrl, PRERENDER_ROUTES, SEO_ROUTES, type PrerenderRoute, type RouteMeta } from "./lib/seo";

// 본문을 미리 넣어 둔다: GuideArticle 은 글 하나씩 지연 로드하지만(lib/guideBodies.ts) 프리렌더는 기다리지 않고 바로 그린다.
for (const guide of GUIDES) seedGuideHtml(guide.slug, renderGuideHtml(guide.body));

// 프리렌더 스크립트(.mjs)는 TS 를 직접 읽지 못하므로 프리렌더 목록·검색 메타·가이드 피드를 SSR 번들을 통해 넘긴다.
export { PRERENDER_ROUTES, SEO_ROUTES };

export type PrerenderPage = { route: PrerenderRoute; meta: RouteMeta };

/** 빌드 때 HTML 로 굳힐 페이지 전부: 고정 목록(lib/seo.ts) + 가이드 글(client/content/guides). sitemap 도 이 목록에서 나온다. */
export function getPrerenderPages(): PrerenderPage[] {
  return [
    ...PRERENDER_ROUTES.map(route => {
      const meta = SEO_ROUTES[route.key];
      if (!meta) throw new Error(`no SEO meta for prerender route ${route.key} (client/src/lib/seo.ts)`);
      return { route, meta };
    }),
    ...GUIDES.map(guide => ({ route: guidePrerenderRoute(guide), meta: guideMeta(guide) })),
  ];
}

export type GuideFeedItem = { title: string; description: string; url: string; date: string };

/** RSS(네이버 서치어드바이저 제출용)에 올릴 가이드 글. 최신순. */
export function getGuideFeedItems(): GuideFeedItem[] {
  return GUIDES.map(guide => ({
    title: guide.title,
    description: guide.description,
    url: absoluteUrl(guidePath(guide)),
    date: guide.updated,
  }));
}

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
