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
