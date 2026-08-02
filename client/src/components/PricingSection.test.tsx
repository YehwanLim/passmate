// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PricingSection from "./PricingSection";

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("PricingSection", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    window.history.replaceState({}, "", "/");
  });

  it("shows the ₩9,900 three-analysis-credit offer", () => {
    render(<PricingSection />);

    expect(screen.getByText("₩9,900")).toBeTruthy();
    expect(screen.getByText("/ 분석 3회권")).toBeTruthy();
    expect(
      screen.getByText(
        "추가 분석은 3회권으로 이용하고, 수정본이나 다른 지원서에 자유롭게 사용할 수 있습니다."
      )
    ).toBeTruthy();
  });

  it("opens entitlements when the three-credit purchase CTA is selected", () => {
    render(<PricingSection />);

    fireEvent.click(
      screen.getByRole("button", { name: "분석 3회권 구매하기" })
    );

    expect(window.location.pathname).toBe("/entitlements");
  });
});
