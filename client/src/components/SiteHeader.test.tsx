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
    for (const item of SITE_NAV_ITEMS.filter(item => item.type === "route")) {
      const link = links.find(candidate => candidate.getAttribute("href") === item.target);
      expect(link, item.label).toBeTruthy();
    }
    const current = links.find(link => link.getAttribute("aria-current") === "page");
    expect(current?.getAttribute("href")).toBe("/analyze");
    expect(screen.getByLabelText("Pre:View 홈").getAttribute("href")).toBe("/");
  });

  it("treats nested paths as the same section (내 지원서 stays current on /my/:projectId)", () => {
    mocks.location = "/my/project-1";
    render(<SiteHeader />);
    const current = screen.getAllByRole("link").find(link => link.getAttribute("aria-current") === "page");
    expect(current?.getAttribute("href")).toBe("/my");
  });

  it("goes home first when a landing section is clicked from another page", () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getAllByRole("button", { name: "서비스 소개" })[0]);
    expect(mocks.navigate).toHaveBeenCalledWith("/");
  });

  it("opens the mobile panel with the same items", () => {
    render(<SiteHeader />);
    fireEvent.click(screen.getByLabelText("모바일 메뉴 열기"));
    expect(document.getElementById("mobile-site-nav")).not.toBeNull();
    expect(document.querySelectorAll("#mobile-site-nav a, #mobile-site-nav button")).toHaveLength(SITE_NAV_ITEMS.length);
  });
});
