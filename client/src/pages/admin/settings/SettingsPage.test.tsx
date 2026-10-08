// @vitest-environment jsdom

import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/lib/admin-entitlements", () => ({
  fetchPremiumSalesSettings: vi.fn(async () => ({ premiumEnabled: true, companyAnalysisEnabled: false })),
  updatePremiumSalesEnabled: vi.fn(),
  updateCompanyAnalysisEnabled: vi.fn(),
}));

vi.mock("@/lib/admin-product-settings", () => ({
  fetchProductSettings: vi.fn(async () => []),
  updateProductSetting: vi.fn(),
}));

import SettingsPage from "./SettingsPage";

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("서버에 실제 반영되는 판매 스위치만 보여 주고 모형 설정은 없다", () => {
    render(createElement(SettingsPage));

    expect(screen.getByText("프리미엄 크레딧 판매")).toBeTruthy();
    expect(screen.getByText("기업 분석 리포트")).toBeTruthy();
    expect(screen.queryByText("AI 상세 피드백 Beta")).toBeNull();
    expect(screen.queryByText("결제 모듈 활성화")).toBeNull();
    expect(screen.queryByText(/read-only/)).toBeNull();
  });
});
