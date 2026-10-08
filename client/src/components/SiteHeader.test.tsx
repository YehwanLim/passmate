// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ location: "/analyze", navigate: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => [mocks.location, mocks.navigate],
  Link: ({ href, children, className, ...rest }: { href: string; children: unknown; className?: string }) => (
    <a href={href} className={className} {...rest}>
      {children as never}
    </a>
  ),
}));
vi.mock("@/components/AuthButton", () => ({ default: () => <span data-testid="auth" /> }));

import { SITE_NAV_ITEMS } from "@/lib/siteNav";
import SiteHeader from "./SiteHeader";

describe("SiteHeader", () => {
  beforeEach(() => {
    mocks.location = "/analyze";
    mocks.navigate.mockReset();
  });
  afterEach(() => cleanup());

  it("renders every nav item as a real link and marks the current page", () => {
    render(<SiteHeader />);
    const links = screen.getAllByRole("link");
    for (const item of SITE_NAV_ITEMS) {
      const link = links.find(candidate => candidate.getAttribute("href") === item.target);
      expect(link, item.label).toBeTruthy();
    }
    const current = links.find(link => link.getAttribute("aria-current") === "page");
    expect(current?.getAttribute("href")).toBe("/analyze");
    expect(screen.getByLabelText("Pre:View 홈").getAttribute("href")).toBe("/");
  });

  it("treats nested paths as the same section (취업 가이드 stays current on /guide/:slug)", () => {
    mocks.location = "/guide/some-guide";
    render(<SiteHeader />);
    const current = screen.getAllByRole("link").find(link => link.getAttribute("aria-current") === "page");
    expect(current?.getAttribute("href")).toBe("/guide");
  });

  it("opens the mobile panel with every item and its sub-items always shown", () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getByLabelText("모바일 메뉴 열기"));
    expect(document.getElementById("mobile-site-nav")).not.toBeNull();
    const childCount = SITE_NAV_ITEMS.reduce((sum, item) => sum + (item.children?.length ?? 0), 0);
    expect(document.querySelectorAll("#mobile-site-nav a")).toHaveLength(SITE_NAV_ITEMS.length + childCount);
    expect(document.querySelector('#mobile-site-nav a[href="/my#experiences"]')?.textContent).toBe("경험 카드");
  });

  it("puts 채용 공고 first and folds 자소서·기업 분석 under 분석하기, my pages under 마이페이지", () => {
    expect(SITE_NAV_ITEMS.map(item => item.label)).toEqual(["채용 공고", "분석하기", "취업 가이드", "이용권", "마이페이지"]);
    render(<SiteHeader />);
    const hrefs = screen.getAllByRole("link").map(link => link.getAttribute("href"));
    for (const href of ["/jobs", "/analyze", "/company-analysis", "/my", "/my#experiences", "/my#company", "/my/entitlements"]) {
      expect(hrefs, href).toContain(href);
    }
  });

  it.each([
    ["/company-analysis", "/analyze"],
    ["/my/entitlements", "/my"],
    ["/jobs/shinsegae-2027", "/jobs"],
  ])("marks the parent current on %s", (location, parentHref) => {
    mocks.location = location;
    render(<SiteHeader />);
    const current = screen.getAllByRole("link").filter(link => link.getAttribute("aria-current") === "page");
    expect(current.map(link => link.getAttribute("href"))).toEqual([parentHref]);
  });
});
