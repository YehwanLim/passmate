import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HOME_NAV_ITEMS } from "./Home";

const homeSource = readFileSync(new URL("./Home.tsx", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../index.css", import.meta.url), "utf8");

describe("HOME_NAV_ITEMS", () => {
  it("shows only immediately usable top navigation items", () => {
    expect(HOME_NAV_ITEMS.map((item) => item.label)).toEqual([
      "서비스 소개",
      "자소서 분석",
      "내 지원서",
    ]);
  });

  it("does not expose coming soon navigation states", () => {
    expect(HOME_NAV_ITEMS.every((item) => item.type !== "coming_soon")).toBe(true);
  });

  it("uses premium motion affordances for landing navigation hover states", () => {
    expect(homeSource).toContain("landing-nav-link");
    expect(homeSource).toContain("bg-[#050505]/35");
    expect(cssSource).toContain("translateY(-2px)");
    expect(cssSource).toContain("rgba(96, 165, 250, 0.1)");
    expect(cssSource).toContain("color: rgba(219, 234, 254, 0.98)");
    expect(cssSource).toContain("filter: brightness(1.08)");
    expect(cssSource).toContain("box-shadow:");
    expect(cssSource).toContain("transition: color 240ms");
    expect(cssSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(cssSource).not.toContain(".landing-nav-link::after");
    expect(cssSource).not.toContain("text-shadow: 0 0 20px");
  });

  it("uses a richer brand CTA instead of a flat white box", () => {
    expect(homeSource).toContain("landing-primary-cta");
    expect(cssSource).toContain(".landing-primary-cta");
    expect(cssSource).toContain("linear-gradient(135deg");
    expect(cssSource).toContain("landing-primary-cta::before");
    expect(cssSource).toContain("landing-primary-cta::after");
    expect(cssSource).toContain("@keyframes cta-light-sweep");
    expect(cssSource).toContain("animation: cta-light-sweep 840ms");
    expect(cssSource).toContain("scale(0.98)");
    expect(cssSource).toContain("border: 1px solid rgba(226, 232, 240, 0.16)");
    expect(cssSource).toContain("rgba(8, 12, 22, 0.26)");
    expect(cssSource).toContain("backdrop-filter: blur(18px)");
    expect(cssSource).toContain("translateY(-2px)");
    expect(homeSource).not.toContain("bg-white text-[#000]");
  });

  it("keeps navigation accessible on mobile through a glass menu", () => {
    expect(homeSource).toContain("isMobileMenuOpen");
    expect(homeSource).toContain("Menu");
    expect(homeSource).toContain("hidden sm:flex");
    expect(homeSource).toContain("mobile-nav-toggle sm:hidden");
    expect(homeSource).toContain("mobile-nav-panel sm:hidden");
    expect(homeSource).toContain('aria-label="모바일 메뉴 열기"');
    expect(homeSource).toContain("aria-expanded={isMobileMenuOpen}");
    expect(homeSource).toContain("mobile-nav-panel");
    expect(homeSource).toContain("mobile-nav-link");
    expect(homeSource).toContain("setIsMobileMenuOpen(false)");
    expect(cssSource).toContain("@media (min-width: 640px)");
    expect(cssSource).toContain(".mobile-nav-toggle");
    expect(cssSource).toContain(".mobile-nav-panel");
    expect(cssSource).toContain(".mobile-nav-panel");
    expect(cssSource).toContain(".mobile-nav-link:hover");
  });
});
