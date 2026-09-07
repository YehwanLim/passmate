// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PRICING, TIERS, formatKrw } from "@/lib/pricing";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));

import PricingSection from "./PricingSection";

// jsdom 환경에서는 import.meta.url 이 file: 이 아니라서 작업 디렉터리 기준으로 읽는다.
const source = readFileSync(join(process.cwd(), "client/src/components/PricingSection.tsx"), "utf8");

describe("PricingSection", () => {
  beforeEach(() => {
    // framer-motion whileInView 가 IntersectionObserver 를 요구한다.
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.navigate.mockReset(); });

  it("renders one card per tier from the shared TIERS list", () => {
    render(<PricingSection />);
    for (const tier of TIERS) {
      expect(screen.getByRole("heading", { name: tier.label })).toBeTruthy();
      expect(screen.getByRole("button", { name: `${tier.label} 구매하기` })).toBeTruthy();
    }
  });

  it("shows the basic tier as a choice between the two single products at the same price", () => {
    render(<PricingSection />);
    expect(screen.getByText("자소서 진단 1회 또는 기업 분석 1회")).toBeTruthy();
    expect(screen.getAllByText(formatKrw(PRICING.single.salePrice)).length).toBeGreaterThanOrEqual(1);
  });

  it("sends every card to the entitlements page", () => {
    render(<PricingSection />);
    screen.getByRole("button", { name: "프리미엄 구매하기" }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/entitlements");
  });

  it("lists the company report contents next to the essay report contents", () => {
    render(<PricingSection />);
    expect(screen.getByText("기업 분석 리포트")).toBeTruthy();
    expect(screen.getByText("출처 링크가 붙은 부록")).toBeTruthy();
  });

  it("takes every price from lib/pricing and iterates TIERS", () => {
    expect(source).toContain("TIERS.map(");
    expect(source).toContain("STANDARD_PER_USE_PRICE");
    expect(source).not.toContain("TRIPLE_PER_USE_PRICE");
    expect(source).not.toMatch(/\d,\d{3}원/);
  });
});
