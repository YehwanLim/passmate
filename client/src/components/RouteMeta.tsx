import { useLayoutEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";

import { applyDocumentMeta, resolveRouteMeta, routeKey } from "@/lib/seo";

/**
 * 라우트가 바뀔 때마다 <head> 의 title·description·canonical·robots 를 lib/seo.ts 의 표대로 맞춘다. 화면을 그리지 않는다.
 *
 * App 에서 VisitTracker 보다 앞에 둔다: layout effect 는 passive effect(VisitTracker 의 useEffect)보다 먼저 돌아
 * GA page_view 가 이전 페이지가 아니라 새 페이지의 title 을 읽는다.
 * 프리렌더된 페이지(scripts/prerender-landing.mjs)의 첫 패스는 건너뛴다: 빌드가 구운 head 가 이미 정확하고,
 * 가이드 글(/guide/<slug>)은 resolveRouteMeta 가 일반 제목만 주므로 여기서 덮으면 청크가 늦거나 못 올 때
 * 제목이 일반값으로 내려앉는다(GuideArticle 이 frontmatter 메타를 다시 씀). 이후 라우팅부터는 늘 적용한다.
 */
export function RouteMeta() {
  const [location] = useLocation();
  const search = useSearch();
  const firstPass = useRef(true);

  useLayoutEffect(() => {
    const prerenderedFor = document.getElementById("root")?.dataset.prerendered;
    const keepBakedHead = firstPass.current && prerenderedFor === routeKey(location, search);
    firstPass.current = false;
    if (keepBakedHead) return;
    applyDocumentMeta(resolveRouteMeta(location, search));
  }, [location, search]);

  return null;
}
