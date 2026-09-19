// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useEffect } from "react";

const mocks = vi.hoisted(() => ({ location: "/", search: "" }));

vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, vi.fn()],
  useSearch: () => mocks.search,
}));

import { NOINDEX, SEO_ROUTES } from "@/lib/seo";
import { RouteMeta } from "./RouteMeta";

describe("RouteMeta", () => {
  beforeEach(() => {
    mocks.location = "/";
    mocks.search = "";
    document.head.innerHTML = `<title>shell</title><meta name="description" content="shell" />`;
  });
  afterEach(() => cleanup());

  it("applies the landing meta on mount and switches when the route changes", () => {
    const view = render(<RouteMeta />);
    expect(document.title).toBe(SEO_ROUTES["/"].title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(SEO_ROUTES["/"].canonical);

    mocks.location = "/report-new";
    mocks.search = "?sample=1";
    view.rerender(<RouteMeta />);
    expect(document.title).toBe(SEO_ROUTES["/report-new?sample=1"].title);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      SEO_ROUTES["/report-new?sample=1"].canonical
    );
  });

  it("keeps the baked head on the first pass of a prerendered page, then applies on navigation", () => {
    // 가이드 글은 빌드가 frontmatter 제목을 굽는다. 첫 패스에서 resolveRouteMeta 의 일반 제목으로 덮으면
    // 청크가 못 올 때 그 제목이 색인된다.
    document.body.innerHTML = '<div id="root" data-prerendered="/guide/growth-story-question"></div>';
    document.head.innerHTML = `<title>자소서 성장과정 | Pre:View</title>`;
    mocks.location = "/guide/growth-story-question";
    const view = render(<RouteMeta />);
    expect(document.title).toBe("자소서 성장과정 | Pre:View");

    mocks.location = "/terms";
    view.rerender(<RouteMeta />);
    expect(document.title).toBe(SEO_ROUTES["/terms"].title);

    mocks.location = "/guide/growth-story-question";
    view.rerender(<RouteMeta />);
    expect(document.title).toBe("취업 가이드 | Pre:View");
    document.body.innerHTML = "";
  });

  it("applies on the first pass when the prerendered route differs from the address", () => {
    document.body.innerHTML = '<div id="root" data-prerendered="/404"></div>';
    mocks.location = "/no-such-page";
    render(<RouteMeta />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
    document.body.innerHTML = "";
  });

  it("marks unknown and private routes noindex", () => {
    mocks.location = "/no-such-page";
    const view = render(<RouteMeta />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();

    mocks.location = "/my/project-1";
    view.rerender(<RouteMeta />);
    expect(document.title).toBe("내 프로젝트 | Pre:View");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe(NOINDEX);
  });

  it("updates the title before a sibling's passive effect reads it", () => {
    // VisitTracker 는 useEffect 안에서 document.title 을 GA 로 보낸다. RouteMeta 가 앞 형제로 layout effect 를 쓰므로
    // 그 시점엔 이미 새 title 이다.
    const seen: string[] = [];
    function TitleReader() {
      useEffect(() => {
        seen.push(document.title);
      });
      return null;
    }
    mocks.location = "/terms";
    render(
      <>
        <RouteMeta />
        <TitleReader />
      </>
    );
    expect(seen).toEqual([SEO_ROUTES["/terms"].title]);
  });
});
