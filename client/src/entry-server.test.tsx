import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANY_REPORT_SAMPLE_COMPANY } from "@/constants/companyReportSampleMeta";
import { GUIDES } from "@/lib/guides";
import { getGuideFeedItems, getPrerenderPages, render, renderRoute, renderSampleReport } from "./entry-server";

// 빌드 시점 프리렌더(scripts/prerender-landing.mjs)가 쓰는 렌더 함수.
// 랜딩 컴포넌트가 렌더 중에 window/document를 읽기 시작하면 여기서 먼저 깨진다.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("entry-server render", () => {
  it("renders the landing page to HTML in node without console errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = render("/");

    expect(html.length).toBeGreaterThan(10_000);
    expect(html).toContain("10초면");
    expect(html).toContain("취업 가이드");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not bake invisible entrance states into the prerendered landing", () => {
    // framer-motion 의 initial 은 SSR 에서 인라인 opacity:0 / scale(0) 으로 구워진다. 그러면 본문이
    // HTML 에 있어도 JS 가 하이드레이션해 애니메이션을 돌릴 때까지 투명하다(폰에서 h1 만 5초).
    // 첫 화면 등장은 CSS 키프레임(index.css .landing-rise)으로, 아래 섹션은 등장 효과 없이 바로 보이게 둔다.
    const html = render("/");
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    // 유일하게 허용하는 scale(0) 은 화면 맨 위 1px 스크롤 진행 막대(스크롤 0 이라 폭 0 이 맞다).
    expect(html.match(/scale[XY]?\(0\)/g)).toEqual(["scaleX(0)"]);
  });

  it("renders the CTAs as real links so they work before the deferred bundle hydrates", () => {
    // landing-boot.js 가 번들 평가를 첫 프레임 뒤로 미루므로, 그 사이 탭한 CTA 는 일반 링크로 이동해야 한다.
    const html = render("/");
    const ctas = (html.match(/<a [^>]*>/g) ?? []).filter(
      tag => tag.includes('href="/analyze"') && tag.includes("landing-primary-cta")
    );
    expect(ctas).toHaveLength(2);
  });

  it("renders the landing, not the 404 fallback, for the root path", () => {
    const html = render("/");
    expect(html).not.toContain("404");
    expect(html).toContain("<h1");
  });
});

describe("entry-server renderSampleReport", () => {
  it("renders the whole public sample report through the lazy route without console errors", async () => {
    // 예시 리포트는 로그인·fetch 없이 상수만 그리므로 빌드 때 굳혀 배포한다(scripts/prerender-landing.mjs).
    // ReportResult 는 App 에서 lazy 라 첫 renderToString 은 폴백만 나온다. 모듈이 준비될 때까지 기다린 결과여야 한다.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = await renderSampleReport();

    expect(html.length).toBeGreaterThan(20_000);
    expect(html).toContain("예시 리포트");
    expect(html).toContain("김민지");
    expect(html).not.toContain("<!--$!-->");
    expect(html).not.toContain("로그인 후 분석 리포트를 확인할 수 있어요");
    expect(consoleError).not.toHaveBeenCalled();
  });
});

describe("entry-server renderRoute for every prerendered page", () => {
  // scripts/prerender-landing.mjs 가 getPrerenderPages() 를 돌며 굳힌다. 하나라도 window 를 렌더 중에 읽거나
  // 등장 애니메이션의 opacity:0 을 구우면 여기서 먼저 깨진다.
  const pages = getPrerenderPages();

  it.each(pages.map(page => [page.route.key, page]))("renders %s without console errors", async (_key, page) => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const html = await renderRoute(page.route.path, page.route.search);
    expect(html.length).toBeGreaterThan(1000);
    expect(html).toContain("<h1");
    expect(html).not.toContain("<!--$!-->");
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("includes the guide index and every published guide with its own meta", () => {
    const keys = pages.map(page => page.route.key);
    expect(keys).toContain("/guide");
    for (const guide of GUIDES) {
      const page = pages.find(candidate => candidate.route.key === `/guide/${guide.slug}`);
      expect(page?.meta.title).toBe(`${guide.title} | Pre:View`);
      expect(page?.route.file).toBe(`guide/${guide.slug}.html`);
    }
    expect(getGuideFeedItems().map(item => item.url)).toEqual(GUIDES.map(guide => `https://pre-view.me/guide/${guide.slug}`));
  });

  it("renders a guide article body, not the 404 fallback", async () => {
    const guide = GUIDES[0];
    const html = await renderRoute(`/guide/${guide.slug}`, "");
    expect(html).toContain(guide.title);
    expect(html).toContain('class="guide-prose');
    expect(html).not.toContain("Page Not Found");
  });

  it("renders the public company sample without the login gate", async () => {
    const html = await renderRoute("/company-report", "sample=1");
    expect(html).toContain(COMPANY_REPORT_SAMPLE_COMPANY);
    expect(html).not.toContain("로그인 후 기업 분석 리포트를 확인할 수 있어요");
  });

  it("renders the pricing tiers on the entitlements page for a guest", async () => {
    const html = await renderRoute("/entitlements", "");
    expect(html).toContain("이용권");
    expect(html).toContain("3,900");
  });
});
