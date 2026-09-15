// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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

import { GUIDES } from "@/lib/guides";
import { NOINDEX } from "@/lib/seo";
import GuideArticle from "./GuideArticle";

describe("GuideArticle", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>shell</title>";
  });
  afterEach(() => cleanup());

  it("renders the guide body as HTML, sets its meta and links to the analyze form", () => {
    const guide = GUIDES[0];
    mocks.slug = guide.slug;
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

  it("falls back to the 404 page with noindex for an unknown slug", () => {
    mocks.slug = "no-such-guide";
    render(<GuideArticle />);

    expect(screen.getByText("404")).toBeTruthy();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
  });
});
