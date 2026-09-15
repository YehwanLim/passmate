// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { PRICING } from "@/lib/pricing";
import {
  applyDocumentMeta,
  NOINDEX,
  PRIVATE_ROUTE_PREFIXES,
  resolveRouteMeta,
  routeKey,
  SEO_ROUTES,
  SITE_ORIGIN,
} from "./seo";

const ROOT_DIR = path.resolve(import.meta.dirname, "../../..");
const INDEXABLE = Object.entries(SEO_ROUTES).filter(([, meta]) => !meta.robots);

// 타깃은 신입 공채 지원자뿐이다(.agents/product-marketing.md). 경력직 키워드는 검색 메타에 절대 쓰지 않는다.
const FORBIDDEN_KEYWORDS = /이직|경력직|경력기술서|커리어 전환/;

describe("SEO_ROUTES", () => {
  it("keeps every title short enough for a result page and every description within a snippet", () => {
    for (const [key, meta] of Object.entries(SEO_ROUTES)) {
      expect(meta.title.length, `${key} title`).toBeLessThanOrEqual(60);
      expect(meta.title, `${key} title`).toContain("Pre:View");
      expect(meta.description.length, `${key} description`).toBeGreaterThanOrEqual(30);
      expect(meta.description.length, `${key} description`).toBeLessThanOrEqual(110);
    }
  });

  it("gives indexable routes an absolute canonical that matches their key", () => {
    for (const [key, meta] of INDEXABLE) {
      expect(meta.canonical, key).toBe(`${SITE_ORIGIN}${key}`);
    }
  });

  it("marks helper routes noindex without a canonical", () => {
    for (const key of ["/login", "/feedback", "/404"]) {
      expect(SEO_ROUTES[key].robots).toBe(NOINDEX);
      expect(SEO_ROUTES[key].canonical).toBeUndefined();
    }
  });

  it("never mentions experienced-hire keywords", () => {
    for (const [key, meta] of Object.entries(SEO_ROUTES)) {
      expect(`${meta.title} ${meta.description}`, key).not.toMatch(FORBIDDEN_KEYWORDS);
    }
  });

  it("targets the search phrase people actually use on the landing and sample report", () => {
    expect(SEO_ROUTES["/"].title).toContain("자소서 첨삭");
    expect(SEO_ROUTES["/report-new?sample=1"].title).toContain("자소서 첨삭 예시");
  });

  it("quotes the live price on the entitlements page", () => {
    const price = `${PRICING.single.salePrice.toLocaleString("ko-KR")}원`;
    expect(SEO_ROUTES["/entitlements"].title).toContain(price);
    expect(SEO_ROUTES["/entitlements"].description).toContain(price);
  });

  it("matches the defaults baked into client/index.html for the SPA shell", () => {
    // app.html(빈 SPA 껍데기)은 index.html 에서 나온다. 랜딩 항목과 어긋나면 JS 전의 첫 화면 메타가 달라진다.
    const shell = readFileSync(path.join(ROOT_DIR, "client/index.html"), "utf8");
    const landing = SEO_ROUTES["/"];
    expect(shell).toContain(`<title>${landing.title}</title>`);
    expect(shell.replace(/\s+/g, " ")).toContain(`name="description" content="${landing.description}"`);
    expect(shell.replace(/\s+/g, " ")).toContain(`property="og:title" content="${landing.title}"`);
    expect(shell.replace(/\s+/g, " ")).toContain(`property="og:description" content="${landing.description}"`);
    expect(shell.replace(/\s+/g, " ")).toContain(`name="twitter:description" content="${landing.description}"`);
    expect(shell).not.toContain('rel="canonical"');
  });
});

describe("routeKey", () => {
  it("keeps only the public sample flag from the query and drops trailing slashes", () => {
    expect(routeKey("/report-new", "?sample=1")).toBe("/report-new?sample=1");
    expect(routeKey("/company-report", "?sample=1&utm_source=threads")).toBe("/company-report?sample=1");
    expect(routeKey("/report-new", "?analysisId=analysis-1")).toBe("/report-new");
    expect(routeKey("/analyze", "")).toBe("/analyze");
    expect(routeKey("/terms/", "")).toBe("/terms");
    expect(routeKey("/", "")).toBe("/");
  });
});

describe("resolveRouteMeta", () => {
  it("returns the exact entry for public routes", () => {
    expect(resolveRouteMeta("/", "")).toBe(SEO_ROUTES["/"]);
    expect(resolveRouteMeta("/report-new", "?sample=1")).toBe(SEO_ROUTES["/report-new?sample=1"]);
  });

  it("marks every private prefix noindex, including nested paths", () => {
    for (const prefix of PRIVATE_ROUTE_PREFIXES) {
      expect(resolveRouteMeta(prefix, "").robots, prefix).toBe(NOINDEX);
      expect(resolveRouteMeta(`${prefix}/anything`, "").robots, prefix).toBe(NOINDEX);
      expect(resolveRouteMeta(prefix, "").canonical, prefix).toBeUndefined();
    }
    // 실제 리포트(로그인 필요)는 예시와 달리 색인하지 않는다.
    expect(resolveRouteMeta("/report-new", "?analysisId=a1").robots).toBe(NOINDEX);
  });

  it("falls back to the noindex 404 entry for unknown paths", () => {
    expect(resolveRouteMeta("/no-such-page", "")).toBe(SEO_ROUTES["/404"]);
    expect(resolveRouteMeta("/myth", "")).toBe(SEO_ROUTES["/404"]);
  });
});

describe("applyDocumentMeta", () => {
  beforeEach(() => {
    document.head.innerHTML = `
      <title>old</title>
      <meta name="description" content="old description" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content="old" />
      <meta property="og:description" content="old description" />
      <meta property="og:url" content="${SITE_ORIGIN}/" />
      <meta name="twitter:title" content="old" />
      <meta name="twitter:description" content="old description" />
    `;
  });

  it("writes title, description, open graph, twitter and canonical for an indexable route", () => {
    applyDocumentMeta(SEO_ROUTES["/entitlements"]);
    const meta = SEO_ROUTES["/entitlements"];
    expect(document.title).toBe(meta.title);
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(meta.description);
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(meta.title);
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(meta.canonical);
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe(meta.title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(meta.canonical);
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
  });

  it("adds robots noindex and removes canonical and og:url for a private route", () => {
    applyDocumentMeta(SEO_ROUTES["/entitlements"]);
    applyDocumentMeta(resolveRouteMeta("/my", ""));
    expect(document.title).toBe("내 프로젝트 | Pre:View");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
  });
});
