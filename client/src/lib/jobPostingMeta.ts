import { jobPostingPath, type JobPostingListing } from "@/constants/jobPostings";
import type { JobPostingDetail } from "@/constants/jobPostingDetails";
import { absoluteUrl, JOBS_INDEX_PATH, type PrerenderRoute, type RouteMeta } from "@/lib/seo";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structuredData";

// 검색 결과에서 잘리지 않는 길이(seo.test.ts 의 SEO_ROUTES 기준과 같다).
const MAX_TITLE_CHARS = 60;

/** 공고 한 장의 검색 메타. 프리렌더(entry-server.tsx)와 JobPostingPage 가 같이 쓴다. */
export function jobPostingMeta(listing: JobPostingListing, detail: JobPostingDetail): RouteMeta {
  const url = absoluteUrl(jobPostingPath(listing));
  // "…신입사원 채용"으로 끝나는 제목에 "채용공고"를 또 붙이면 "채용 채용공고"가 된다.
  const long = listing.title.endsWith("채용")
    ? `${listing.title}공고·자소서 | Pre:View`
    : `${listing.title} 채용공고·자소서 | Pre:View`;
  return {
    title: long.length <= MAX_TITLE_CHARS ? long : `${listing.title} | Pre:View`,
    description: detail.description,
    canonical: url,
    ogType: "article",
    updated: listing.updated,
    jsonLd: [
      articleJsonLd({
        url,
        title: listing.title,
        description: detail.description,
        datePublished: listing.updated,
        dateModified: listing.updated,
        keywords: detail.keywords.split(",").map(keyword => keyword.trim()).filter(Boolean),
      }),
      breadcrumbJsonLd([
        { name: "홈", url: absoluteUrl("/") },
        { name: "채용 공고", url: absoluteUrl(JOBS_INDEX_PATH) },
        { name: listing.title, url },
      ]),
    ],
  };
}

export function jobPrerenderRoute(listing: JobPostingListing): PrerenderRoute {
  const path = jobPostingPath(listing);
  return { key: path, path, search: "", file: `jobs/${listing.slug}.html` };
}
