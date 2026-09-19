import { parseGuideFile, type Guide } from "@shared/guideFrontmatter";
import type { PrerenderRoute } from "@/lib/seo";
import { guidePath, sortGuides } from "@/lib/guideSummaries";

/**
 * 취업 가이드 글(본문 포함). 원본은 client/content/guides/*.md (frontmatter + 마크다운).
 *
 * - 빌드 프리렌더(entry-server.tsx getPrerenderPages)가 /guide 와 /guide/<slug> 를 HTML 로 굳히고 sitemap·RSS 에 올린다.
 * - 이 모듈은 모든 글의 마크다운 원문을 품는다. **브라우저 번들에서 import 하지 않는다** — 프리렌더(entry-server.tsx)와
 *   테스트 전용이다. 목록은 lib/guideSummaries.ts, 글 하나의 본문은 lib/guideBodies.ts, 메타는 lib/guideMeta.ts.
 * - 본문은 레포 저자가 쓰는 신뢰 소스라 sanitize 없이 HTML 로 바꾼다(GuideArticle 의 dangerouslySetInnerHTML).
 */
export type { Guide };
export { parseFrontmatter, parseGuideFile } from "@shared/guideFrontmatter";
export { guidePath };
export { guideMeta } from "@/lib/guideMeta";
export { renderGuideHtml } from "@/lib/guideMarkdown";

const RAW_GUIDES = import.meta.glob("../../content/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** 발행된 글, 최신순. */
export const GUIDES: readonly Guide[] = sortGuides(
  Object.entries(RAW_GUIDES).map(([filePath, raw]) => parseGuideFile(filePath, raw))
);

export function findGuide(slug: string | undefined): Guide | undefined {
  return slug ? GUIDES.find(guide => guide.slug === slug) : undefined;
}

export function guidePrerenderRoute(guide: Guide): PrerenderRoute {
  const path = guidePath(guide);
  return { key: path, path, search: "", file: `guide/${guide.slug}.html` };
}
