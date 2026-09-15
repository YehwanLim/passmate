import { marked } from "marked";
import { absoluteUrl, GUIDE_INDEX_PATH, type PrerenderRoute, type RouteMeta } from "@/lib/seo";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structuredData";

/**
 * 취업 가이드 글. 원본은 client/content/guides/*.md (frontmatter + 마크다운).
 *
 * - 빌드 프리렌더(entry-server.tsx getPrerenderPages)가 /guide 와 /guide/<slug> 를 HTML 로 굳히고 sitemap·RSS 에 올린다.
 * - 이 모듈은 마크다운 원문 전체를 품으므로 초기 번들(seo.ts, RouteMeta)에서 import 하지 않는다. 가이드 페이지는 lazy 다.
 * - 본문은 레포 저자가 쓰는 신뢰 소스라 sanitize 없이 HTML 로 바꾼다(GuideArticle 의 dangerouslySetInnerHTML).
 */
export type Guide = {
  slug: string;
  title: string;
  description: string;
  /** YYYY-MM-DD */
  date: string;
  /** YYYY-MM-DD. 없으면 date 와 같다. */
  updated: string;
  keywords: readonly string[];
  draft: boolean;
  /** frontmatter 를 뗀 마크다운 본문 */
  body: string;
};

const RAW_GUIDES = import.meta.glob("../../content/guides/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(FRONTMATTER);
  if (!match) throw new Error("guide is missing a frontmatter block (--- ... ---)");
  const data: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator === -1) throw new Error(`frontmatter line without a colon: ${line}`);
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    data[key] = value;
  }
  return { data, body: match[2].trim() };
}

export function buildGuide(filePath: string, raw: string): Guide {
  const { data, body } = parseFrontmatter(raw);
  const fileSlug = filePath.split("/").pop()!.replace(/\.md$/, "");
  const slug = data.slug || fileSlug;
  for (const field of ["title", "description", "date"] as const) {
    if (!data[field]) throw new Error(`guide ${fileSlug} is missing frontmatter "${field}"`);
  }
  const updated = data.updated || data.date;
  for (const [field, value] of [["date", data.date], ["updated", updated]] as const) {
    if (!DATE.test(value)) throw new Error(`guide ${fileSlug} has a non YYYY-MM-DD ${field}: ${value}`);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`guide ${fileSlug} has a slug that is not lowercase-kebab: ${slug}`);
  return {
    slug,
    title: data.title,
    description: data.description,
    date: data.date,
    updated,
    keywords: (data.keywords ?? "")
      .split(",")
      .map(keyword => keyword.trim())
      .filter(Boolean),
    draft: data.draft === "true",
    body,
  };
}

/** 발행된 글, 최신순. */
export const GUIDES: readonly Guide[] = Object.entries(RAW_GUIDES)
  .map(([filePath, raw]) => buildGuide(filePath, raw))
  .filter(guide => !guide.draft)
  .sort((a, b) => b.date.localeCompare(a.date));

export function findGuide(slug: string | undefined): Guide | undefined {
  return slug ? GUIDES.find(guide => guide.slug === slug) : undefined;
}

export function guidePath(guide: Pick<Guide, "slug">): string {
  return `${GUIDE_INDEX_PATH}/${guide.slug}`;
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
