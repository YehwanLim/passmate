import type { GuideSummary } from "@shared/guideFrontmatter";
import { guidePath } from "@/lib/guideSummaries";
import { absoluteUrl, GUIDE_INDEX_PATH, type RouteMeta } from "@/lib/seo";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structuredData";

/** 글 하나의 검색 메타. 본문이 필요 없어 요약(frontmatter)만으로 만든다 — 프리렌더와 GuideArticle 이 같이 쓴다. */
export function guideMeta(guide: GuideSummary): RouteMeta {
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
