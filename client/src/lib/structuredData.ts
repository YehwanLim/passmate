import { PRICING, type PurchaseProductKey } from "@/lib/pricing";
import { SITE_LOGO, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

/**
 * schema.org JSON-LD. 프리렌더(scripts/prerender-landing.mjs)가 <script type="application/ld+json"> 으로 <head> 에 넣는다.
 * 데이터 블록은 실행되지 않으므로 CSP script-src 의 제약을 받지 않는다.
 * FAQPage 는 넣지 않는다: 화면에 보이는 FAQ 섹션이 없고, 보이지 않는 Q&A 의 구조화 데이터는 정책 위반이다.
 */
export type JsonLd = Record<string, unknown>;

const CONTEXT = "https://schema.org";

/** 판매 중인 상품만. triple 은 판매 종료라 과거 결제 라벨에만 쓴다(pricing.ts). */
export const OFFERED_PRODUCTS: readonly PurchaseProductKey[] = ["single", "company", "standard", "premium"];

export function organizationJsonLd(): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "Organization",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    logo: SITE_LOGO,
  };
}

export function webSiteJsonLd(): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    inLanguage: "ko",
  };
}

export function softwareApplicationJsonLd(): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "ko",
    description:
      "지원 기업·직무와 자소서 문항을 입력하면 채용 담당자 시선으로 읽은 정성 리포트를 만드는 자소서 진단 서비스.",
    offers: OFFERED_PRODUCTS.map(key => ({
      "@type": "Offer",
      name: PRICING[key].label,
      price: PRICING[key].salePrice,
      priceCurrency: "KRW",
      url: `${SITE_ORIGIN}/entitlements`,
      availability: "https://schema.org/InStock",
    })),
  };
}

export type ArticleInput = {
  url: string;
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  keywords: readonly string[];
};

export function articleJsonLd(article: ArticleInput): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "Article",
    headline: article.title,
    description: article.description,
    url: article.url,
    mainEntityOfPage: article.url,
    inLanguage: "ko",
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    keywords: article.keywords.join(", "),
    author: { "@type": "Organization", name: SITE_NAME, url: `${SITE_ORIGIN}/` },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: SITE_LOGO } },
  };
}

export function breadcrumbJsonLd(items: readonly { name: string; url: string }[]): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
