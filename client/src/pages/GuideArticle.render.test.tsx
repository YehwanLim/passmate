// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ slug: "" }));

vi.mock("wouter", () => ({
  useParams: () => ({ slug: mocks.slug }),
  useLocation: () => ["/guide/x", vi.fn()],
  Link: ({ href, children, className }: { href: string; children: unknown; className?: string }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/components/MoodShiftBackground", () => ({ default: () => null }));
// 전역 헤더(SiteHeader)의 로그인 버튼은 AuthProvider 가 필요하다. 이 테스트는 본문만 본다.
vi.mock("@/components/AuthButton", () => ({ default: () => null }));

import { resetGuideHtml, seedGuideHtml } from "@/lib/guideBodies";
import { GUIDES, renderGuideHtml } from "@/lib/guides";
import { NOINDEX } from "@/lib/seo";
import GuideArticle from "./GuideArticle";

describe("GuideArticle", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>shell</title>";
    document.body.innerHTML = "";
    resetGuideHtml();
  });
  afterEach(() => cleanup());

  it("renders the guide body as HTML, sets its meta and links to the analyze form", () => {
    const guide = GUIDES[0];
    mocks.slug = guide.slug;
    // 프리렌더(entry-server.tsx)와 같은 경로: 본문을 미리 넣어 두면 서스펜드하지 않는다.
    seedGuideHtml(guide.slug, renderGuideHtml(guide.body));
    render(<GuideArticle />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(guide.title);
    expect(document.querySelectorAll(".guide-prose h2").length).toBeGreaterThan(0);
    expect(document.title).toBe(`${guide.title} | Pre:View`);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `https://pre-view.me/guide/${guide.slug}`
    );
    expect(document.querySelector('meta[property="og:type"]')?.getAttribute("content")).toBe("article");
    expect(document.querySelectorAll('a[href="/analyze"]').length).toBeGreaterThan(0);
  });

  it("loads only this guide's markdown when the body was not prerendered", async () => {
    const guide = GUIDES[0];
    mocks.slug = guide.slug;
    render(<GuideArticle />);

    // 제목·메타는 요약에서 바로 나오고, 본문만 Suspense 뒤에 온다.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(guide.title);
    expect(document.querySelector(".guide-prose")).toBeNull();
    await waitFor(() => expect(document.querySelectorAll(".guide-prose h2").length).toBeGreaterThan(0));
    // 브라우저가 직렬화한 innerHTML 은 원문 문자열과 표기가 다를 수 있어(<br> 등) 같은 방식으로 정규화해 비교한다.
    const expected = document.createElement("div");
    expected.innerHTML = renderGuideHtml(guide.body);
    expect(document.querySelector(".guide-prose")?.innerHTML).toBe(expected.innerHTML);
  });

  it("reuses the prerendered body in the DOM instead of loading markdown", () => {
    const guide = GUIDES[0];
    mocks.slug = guide.slug;
    document.body.innerHTML = `<div id="root" data-prerendered="/guide/${guide.slug}"><div class="guide-prose"><h2>프리렌더 본문</h2></div></div>`;
    const view = render(<GuideArticle />);

    expect(view.container.querySelector(".guide-prose h2")?.textContent).toBe("프리렌더 본문");
  });

  it("lists guides from the same category first under 이어서 읽기", () => {
    const guide = GUIDES.find(candidate => GUIDES.filter(other => other.category === candidate.category).length >= 3)!;
    mocks.slug = guide.slug;
    seedGuideHtml(guide.slug, "<p>본문</p>");
    render(<GuideArticle />);

    const aside = screen.getByText("이어서 읽기").parentElement!;
    const relatedSlugs = Array.from(aside.querySelectorAll('a[href^="/guide/"]')).map(link =>
      link.getAttribute("href")!.replace("/guide/", "")
    );
    const sameCategory = GUIDES.filter(other => other.category === guide.category && other.slug !== guide.slug).map(
      other => other.slug
    );
    expect(relatedSlugs.slice(0, 2).every(slug => sameCategory.includes(slug))).toBe(true);
  });

  it("falls back to the 404 page with noindex for an unknown slug", () => {
    mocks.slug = "no-such-guide";
    render(<GuideArticle />);

    expect(screen.getByText("404")).toBeTruthy();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
  });
});
