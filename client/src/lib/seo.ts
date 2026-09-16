import {
  COMPANY_REPORT_SAMPLE_COMPANY,
  COMPANY_REPORT_SAMPLE_JOB_ROLE,
} from "@/constants/companyReportSampleMeta";
import {
  RESUME_REPORT_SAMPLE_COMPANY,
  RESUME_REPORT_SAMPLE_JOB_ROLE,
  RESUME_REPORT_SAMPLE_PATH,
} from "@/constants/resumeReportSampleMeta";
import { PRICING } from "@/lib/pricing";
import { SITE_ORIGIN } from "@/lib/site";
import {
  organizationJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
  type JsonLd,
} from "@/lib/structuredData";

export { DEFAULT_OG_IMAGE, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

/**
 * 라우트별 검색엔진 메타(title·description·canonical·robots)의 단일 정의처.
 *
 * - 빌드 프리렌더(scripts/prerender-landing.mjs)가 dist/ssr/entry-server.js 를 통해 이 표를 읽어 HTML <head> 에 굽는다.
 * - 클라이언트는 RouteMeta(components/RouteMeta.tsx)가 라우트 전환마다 applyDocumentMeta 로 같은 값을 문서에 반영한다.
 * - client/index.html 의 기본값은 `/` 항목과 같아야 한다(seo.test.ts 가 검사).
 *
 * 키워드 정책: 검색 메타에는 사용자가 실제로 검색하는 "자소서 첨삭"을 쓴다(랜딩 본문 카피는 "진단"을 유지).
 * 타깃은 신입 공채 지원자뿐이라 "이직·경력직·경력기술서"는 어디에도 쓰지 않는다(테스트로 강제).
 */

export const NOINDEX = "noindex, nofollow";

export type RouteMeta = {
  title: string;
  description: string;
  /** 절대 URL. 색인하지 않는 페이지는 생략한다. */
  canonical?: string;
  robots?: typeof NOINDEX;
  ogType?: "website" | "article";
  /** sitemap 의 lastmod(YYYY-MM-DD). 페이지 본문·메타를 고친 날로 손수 올린다. */
  updated?: string;
  /** 프리렌더가 <head> 에 넣는 schema.org 블록 */
  jsonLd?: readonly JsonLd[];
};

export function absoluteUrl(pathWithQuery: string): string {
  return `${SITE_ORIGIN}${pathWithQuery}`;
}

const absolute = absoluteUrl;

function won(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

const SITE_DESCRIPTION =
  "자소서 첨삭 전에 채용 담당자 시선으로 먼저 읽어 봅니다. 첫인상, 핵심 진단, 문장 분석, 예상 면접 질문까지 담은 정성 리포트. 첫 분석은 무료.";

export const COMPANY_REPORT_SAMPLE_PATH = "/company-report?sample=1";

export const GUIDE_INDEX_PATH = "/guide";
export const GUIDE_INDEX_TITLE = "취업 가이드 - 채용 담당자가 진짜 보는 것 | Pre:View";
export const GUIDE_INDEX_DESCRIPTION =
  "채용 담당자가 자소서에서 실제로 확인하는 것을 첫인상·문항별·수정 순서로 정리했습니다. 자소서 첨삭이나 AI 피드백을 받기 전에 읽어 두면 어디부터 고칠지 보입니다.";

/** 색인 대상 공개 라우트와 로그인 없이 닿는 보조 라우트. 키는 routeKey() 결과와 같은 모양이다. */
export const SEO_ROUTES: Record<string, RouteMeta> = {
  "/": {
    title: "자소서 첨삭 AI 진단 리포트 - 채용 담당자 시선으로 읽는 Pre:View",
    description: SITE_DESCRIPTION,
    canonical: absolute("/"),
    updated: "2026-09-14",
    jsonLd: [organizationJsonLd(), webSiteJsonLd(), softwareApplicationJsonLd()],
  },
  "/analyze": {
    title: "자소서 무료 분석 시작하기 | Pre:View",
    description:
      "지원 기업·직무와 자소서 문항을 입력하면 1분 안에 채용 담당자 시선의 진단 리포트를 받습니다. 첫 분석은 무료, 실패하면 과금되지 않습니다.",
    canonical: absolute("/analyze"),
    updated: "2026-09-14",
  },
  [RESUME_REPORT_SAMPLE_PATH]: {
    title: `자소서 첨삭 예시 리포트 · ${RESUME_REPORT_SAMPLE_COMPANY} ${RESUME_REPORT_SAMPLE_JOB_ROLE} | Pre:View`,
    description:
      "Pre:View가 실제로 만드는 자소서 진단 리포트 예시. 첫인상부터 핵심 진단, 문장 분석, 예상 면접 질문, 실무자 코멘트까지 그대로 확인하세요.",
    canonical: absolute(RESUME_REPORT_SAMPLE_PATH),
    updated: "2026-09-14",
  },
  [COMPANY_REPORT_SAMPLE_PATH]: {
    title: `기업 분석 리포트 예시 · ${COMPANY_REPORT_SAMPLE_COMPANY} ${COMPANY_REPORT_SAMPLE_JOB_ROLE} | Pre:View`,
    description:
      "자소서를 쓰기 전에 회사부터 읽는 기업 분석 리포트 예시. 사업 방향, 채용 기준, 지원 동기에 쓸 근거를 출처와 함께 정리합니다.",
    canonical: absolute(COMPANY_REPORT_SAMPLE_PATH),
    updated: "2026-09-14",
  },
  "/entitlements": {
    title: `이용권 안내 - 자소서 진단 ${won(PRICING.single.salePrice)}부터 | Pre:View`,
    description: `전문가 첨삭 1회 비용으로 여러 번 진단받으세요. 자소서 진단 1회 ${won(PRICING.single.salePrice)}, 기업 분석 포함 묶음 ${won(PRICING.standard.salePrice)}부터. 분석이 실패하면 과금되지 않습니다.`,
    canonical: absolute("/entitlements"),
    updated: "2026-09-14",
    jsonLd: [softwareApplicationJsonLd()],
  },
  [GUIDE_INDEX_PATH]: {
    title: GUIDE_INDEX_TITLE,
    description: GUIDE_INDEX_DESCRIPTION,
    canonical: absolute(GUIDE_INDEX_PATH),
    updated: "2026-09-14",
  },
  "/terms": {
    title: "이용약관 | Pre:View",
    description: "Pre:View 서비스 이용약관. 이용권, 결제와 환불, 분석 결과의 이용 범위를 안내합니다.",
    canonical: absolute("/terms"),
    updated: "2026-09-01",
  },
  "/privacy": {
    title: "개인정보처리방침 | Pre:View",
    description: "Pre:View가 수집하는 개인정보의 항목, 이용 목적, 보관 기간과 이용자의 권리를 안내합니다.",
    canonical: absolute("/privacy"),
    updated: "2026-09-01",
  },
  "/login": {
    title: "로그인 | Pre:View",
    description: SITE_DESCRIPTION,
    robots: NOINDEX,
  },
  "/feedback": {
    title: "피드백 설문 | Pre:View",
    description: SITE_DESCRIPTION,
    robots: NOINDEX,
  },
  "/404": {
    title: "페이지를 찾을 수 없습니다 | Pre:View",
    description: SITE_DESCRIPTION,
    robots: NOINDEX,
  },
};

export type PrerenderRoute = {
  /** SEO_ROUTES 의 키이자 main.tsx 가 하이드레이션 여부를 판정하는 data-prerendered 값 */
  key: string;
  path: string;
  search: string;
  /** dist/public 아래 출력 파일. vercel.json 이 해당 경로를 이 파일로 리라이트한다(index.html 만 파일시스템 우선). */
  file: string;
};

/**
 * 빌드 때 HTML 로 굳히는 경로(scripts/prerender-landing.mjs). 로그인·fetch 없이 상수만으로 그려지는 공개 페이지만 올린다.
 * `/analyze` 는 공개 폼이지만 세션 초안·쿼리로 첫 상태가 달라져 하이드레이션이 어긋나므로 넣지 않는다(RouteMeta 가 메타만 맞춘다).
 * 항목을 추가하면 vercel.json 리라이트도 같이 추가한다(scripts/prerender-landing.test.js 가 검사).
 */
export const PRERENDER_ROUTES: readonly PrerenderRoute[] = [
  { key: "/", path: "/", search: "", file: "index.html" },
  { key: RESUME_REPORT_SAMPLE_PATH, path: "/report-new", search: "sample=1", file: "sample-report.html" },
  { key: COMPANY_REPORT_SAMPLE_PATH, path: "/company-report", search: "sample=1", file: "company-sample-report.html" },
  { key: "/terms", path: "/terms", search: "", file: "terms.html" },
  { key: "/privacy", path: "/privacy", search: "", file: "privacy.html" },
  { key: "/entitlements", path: "/entitlements", search: "", file: "entitlements.html" },
  // 가이드 글(/guide/<slug>)은 content/guides 에서 나오므로 entry-server.tsx 의 getPrerenderPages() 가 덧붙인다.
  { key: GUIDE_INDEX_PATH, path: GUIDE_INDEX_PATH, search: "", file: "guide.html" },
  // Vercel 은 어떤 라우트에도 맞지 않는 요청에 출력 루트의 404.html 을 404 상태로 준다.
  { key: "/404", path: "/404", search: "", file: "404.html" },
];

/** 로그인이 필요하거나 개인 데이터를 보이는 접두 경로. robots.txt 의 Disallow 와 별개로 meta noindex 를 단다. */
const PRIVATE_ROUTE_TITLES: ReadonlyArray<[prefix: string, title: string]> = [
  ["/my", "내 프로젝트 | Pre:View"],
  ["/admin", "관리자 | Pre:View"],
  ["/checkout", "결제 | Pre:View"],
  ["/analysis-pending", "분석 진행 중 | Pre:View"],
  ["/account", "계정 | Pre:View"],
  ["/company-analysis", "기업 분석 | Pre:View"],
];

export const PRIVATE_ROUTE_PREFIXES = PRIVATE_ROUTE_TITLES.map(([prefix]) => prefix);

/**
 * 경로 + 검색어를 메타 표의 키로 만든다. 쿼리는 떼되 공개 예시 표시(`sample=1`)만 남긴다.
 * GA page_view 경로(VisitTracker.pageViewPath)와 같은 규칙이라 두 곳이 같은 페이지를 같은 이름으로 부른다.
 */
export function routeKey(pathname: string, search: string): string {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return new URLSearchParams(search).get("sample") === "1" ? `${path}?sample=1` : path;
}

export function resolveRouteMeta(pathname: string, search: string): RouteMeta {
  const key = routeKey(pathname, search);
  const exact = SEO_ROUTES[key];
  if (exact) return exact;
  // 가이드 글은 페이지(GuideArticle)가 frontmatter 로 정확한 메타를 덮어쓴다. 여기서는 색인 가능한 기본값만 준다.
  if (key.startsWith(`${GUIDE_INDEX_PATH}/`)) {
    return { title: "취업 가이드 | Pre:View", description: GUIDE_INDEX_DESCRIPTION, canonical: absolute(key) };
  }
  const privateRoute = PRIVATE_ROUTE_TITLES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (privateRoute) {
    return { title: privateRoute[1], description: SITE_DESCRIPTION, robots: NOINDEX };
  }
  return SEO_ROUTES["/404"];
}

function upsertMeta(doc: Document, attr: "name" | "property", key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`;
  let element = doc.head.querySelector<HTMLMetaElement>(selector);
  if (content === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = doc.createElement("meta");
    element.setAttribute(attr, key);
    doc.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertLink(doc: Document, rel: string, href: string | null) {
  let element = doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === null) {
    element?.remove();
    return;
  }
  if (!element) {
    element = doc.createElement("link");
    element.setAttribute("rel", rel);
    doc.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

/** 문서 <head> 를 메타 표의 값으로 맞춘다. 프리렌더된 페이지에서는 같은 값이라 사실상 no-op 이다. */
export function applyDocumentMeta(meta: RouteMeta, doc: Document = document): void {
  doc.title = meta.title;
  upsertMeta(doc, "name", "description", meta.description);
  upsertMeta(doc, "name", "robots", meta.robots ?? null);
  upsertMeta(doc, "property", "og:type", meta.ogType ?? "website");
  upsertMeta(doc, "property", "og:title", meta.title);
  upsertMeta(doc, "property", "og:description", meta.description);
  upsertMeta(doc, "property", "og:url", meta.canonical ?? null);
  upsertMeta(doc, "name", "twitter:title", meta.title);
  upsertMeta(doc, "name", "twitter:description", meta.description);
  upsertLink(doc, "canonical", meta.canonical ?? null);
}
