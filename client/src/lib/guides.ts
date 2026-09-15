import { marked } from "marked";
import { parseGuideFile, type Guide } from "@shared/guideFrontmatter";
import { absoluteUrl, GUIDE_INDEX_PATH, type PrerenderRoute, type RouteMeta } from "@/lib/seo";
import { guidePath, sortGuides } from "@/lib/guideSummaries";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structuredData";

/**
 * 취업 가이드 글(본문 포함). 원본은 client/content/guides/*.md (frontmatter + 마크다운).
 *
 * - 빌드 프리렌더(entry-server.tsx getPrerenderPages)가 /guide 와 /guide/<slug> 를 HTML 로 굳히고 sitemap·RSS 에 올린다.
 * - 이 모듈은 마크다운 원문 전체를 품으므로 초기 번들(seo.ts, RouteMeta, 랜딩)에서 import 하지 않는다.
 *   목록만 필요하면 lib/guideSummaries.ts 를 쓴다. 가이드 페이지는 lazy 다.
 * - 본문은 레포 저자가 쓰는 신뢰 소스라 sanitize 없이 HTML 로 바꾼다(GuideArticle 의 dangerouslySetInnerHTML).
 */
export type { Guide };
export { parseFrontmatter, parseGuideFile } from "@shared/guideFrontmatter";
export { guidePath };

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

export function guideMeta(guide: Guide): RouteMeta {
  const url = absoluteUrl(guidePath(guide));
  return {
    title: `${guide.title} | Pre:View`,
    description: guide.description,
    canonical: url,
    ogType: "article",
    updated: guide.updated,
    jsonLd: [
      articleJsonLd({
        url,
        title: guide.title,
        description: guide.description,
        datePublished: guide.date,
        dateModified: guide.updated,
        keywords: guide.keywords,
      }),
      breadcrumbJsonLd([
        { name: "홈", url: absoluteUrl("/") },
        { name: "취업 가이드", url: absoluteUrl(GUIDE_INDEX_PATH) },
        { name: guide.title, url },
      ]),
    ],
  };
}

export function guidePrerenderRoute(guide: Guide): PrerenderRoute {
  const path = guidePath(guide);
  return { key: path, path, search: "", file: `guide/${guide.slug}.html` };
}

marked.use({ gfm: true });

/** 마크다운 본문 → HTML. 서버(프리렌더)와 클라이언트(하이드레이션)가 같은 marked 버전으로 같은 결과를 낸다. */
export function renderGuideHtml(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
