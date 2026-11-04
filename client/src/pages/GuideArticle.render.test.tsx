// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ slug: "", sendFunnelEvent: vi.fn() }));

vi.mock("wouter", () => ({
  useParams: () => ({ slug: mocks.slug }),
  useLocation: () => ["/guide/x", vi.fn()],
  Link: ({ href, children, className, onClick }: { href: string; children: unknown; className?: string; onClick?: () => void }) => (
    // wouter Link 처럼 페이지를 떠나지 않는다(jsdom 은 실제 이동을 못 한다).
    <a href={href} className={className} onClick={event => { event.preventDefault(); onClick?.(); }}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/lib/siteVisits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendFunnelEvent: mocks.sendFunnelEvent,
}));
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
  afterEach(() => {
    cleanup();
    mocks.sendFunnelEvent.mockClear();
  });

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

  /** 글 끝 카드의 두 버튼(분석·예시 리포트)과 폰 아래 띠의 링크. 띠는 처음엔 숨어(inert) 있어 role 대신 구조로 찾는다. */
  function ctaLinks() {
    const card = document.getElementById("guide-end-cta")!;
    const [analyze, sample] = Array.from(card.querySelectorAll("a"));
    const bar = document.querySelector<HTMLAnchorElement>("[data-visible] a")!;
    return { card, analyze, sample, bar };
  }

  it("면접 후기 글은 띠·글 끝 카드를 예상 질문 문구로 바꾸고 intent=interview 로 보낸다", () => {
    const guide = GUIDES.find(candidate => candidate.category === "면접 후기" && candidate.company)!;
    mocks.slug = guide.slug;
    seedGuideHtml(guide.slug, "<p>본문</p>");
    render(<GuideArticle />);

    const { card, analyze, sample, bar } = ctaLinks();
    const company = guide.company!;
    expect(card.querySelector("h2")?.textContent).toBe(`${company} 면접, 내 자소서로는 뭘 물어볼까요?`);
    expect(card.textContent).toContain("낸 자소서를 넣으면 면접관이 물을 질문을 뽑아 드려요. 첫 분석은 무료예요.");
    expect(analyze.textContent).toBe("예상 질문 뽑기");
    expect(analyze.getAttribute("href")).toBe(`/analyze?company=${encodeURIComponent(company)}&intent=interview`);
    // 예시 리포트도 예상 질문 섹션부터 연다.
    expect(sample.getAttribute("href")).toBe("/report-new?sample=1&intent=interview");

    expect(bar.textContent).toBe(`${company} 면접, 내 자소서로는 뭘 물어볼까요?예상 질문 보기`);
    expect(bar.getAttribute("href")).toBe(analyze.getAttribute("href"));

    // 클릭 기록은 같은 content_cta_click 에 위치 값만 -interview 로 나눈다.
    fireEvent.click(bar);
    fireEvent.click(analyze);
    fireEvent.click(sample);
    expect(mocks.sendFunnelEvent.mock.calls).toEqual([
      ["content_cta_click", `guide-bar-interview:${guide.slug}`],
      ["content_cta_click", `guide-card-interview:${guide.slug}`],
      ["content_cta_click", `guide-sample-interview:${guide.slug}`],
    ]);
  });

  it("자소서 글은 띠·카드 문구와 링크, 기록 위치가 그대로다", () => {
    const guide = GUIDES.find(candidate => candidate.category !== "면접 후기")!;
    mocks.slug = guide.slug;
    seedGuideHtml(guide.slug, "<p>본문</p>");
    render(<GuideArticle />);

    const { card, analyze, sample, bar } = ctaLinks();
    const expectedHref = guide.company ? `/analyze?company=${encodeURIComponent(guide.company)}` : "/analyze";
    expect(card.querySelector("h2")?.textContent).toBe("다 쓴 자소서, 내기 전에 한 번 읽혀 보세요");
    expect(analyze.textContent).toBe("내 자소서 무료로 분석하기");
    expect(analyze.getAttribute("href")).toBe(expectedHref);
    expect(sample.getAttribute("href")).toBe("/report-new?sample=1");
    expect(bar.textContent).toBe(`${guide.company ?? "내"} 자소서, 이대로 내도 될까요?무료 분석`);
    expect(bar.getAttribute("href")).toBe(expectedHref);

    fireEvent.click(bar);
    fireEvent.click(analyze);
    fireEvent.click(sample);
    expect(mocks.sendFunnelEvent.mock.calls).toEqual([
      ["content_cta_click", `guide-bar:${guide.slug}`],
      ["content_cta_click", `guide-card:${guide.slug}`],
      ["content_cta_click", `guide-sample:${guide.slug}`],
    ]);
  });

  it("falls back to the 404 page with noindex for an unknown slug", () => {
    mocks.slug = "no-such-guide";
    render(<GuideArticle />);

    expect(screen.getByText("404")).toBeTruthy();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
  });
});
