import { useLayoutEffect } from "react";
import { useLocation, useSearch } from "wouter";

import { applyDocumentMeta, resolveRouteMeta } from "@/lib/seo";

/**
 * 라우트가 바뀔 때마다 <head> 의 title·description·canonical·robots 를 lib/seo.ts 의 표대로 맞춘다. 화면을 그리지 않는다.
 *
 * App 에서 VisitTracker 보다 앞에 둔다: layout effect 는 passive effect(VisitTracker 의 useEffect)보다 먼저 돌아
 * GA page_view 가 이전 페이지가 아니라 새 페이지의 title 을 읽는다.
 * 프리렌더된 페이지(scripts/prerender-landing.mjs)는 같은 값이 이미 HTML 에 있어 하이드레이션 때 바뀌는 게 없다.
 */
export function RouteMeta() {
  const [location] = useLocation();
  const search = useSearch();

  useLayoutEffect(() => {
    applyDocumentMeta(resolveRouteMeta(location, search));
  }, [location, search]);

  return null;
}
