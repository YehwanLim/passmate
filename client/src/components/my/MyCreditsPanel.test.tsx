// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchEntitlementSummary: vi.fn(), navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/my", mocks.navigate] }));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
}));
vi.mock("@/lib/entitlements", () => ({ fetchEntitlementSummary: mocks.fetchEntitlementSummary }));

import MyCreditsPanel from "./MyCreditsPanel";

const summary = (extra = {}) => ({
  premiumEnabled: true, freeRemaining: 0, bonusRemaining: 0, premiumRemaining: 0, remaining: 0,
  groblePaymentUrl: null, grobleSinglePaymentUrl: null, checkoutUrls: {}, feedbackRewardClaimed: false,
  companyAnalysisEnabled: true, companyRemaining: 0, ...extra,
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MyCreditsPanel", () => {
  it("계정과 남은 자소서·기업 분석 횟수를 보여 준다", async () => {
    mocks.fetchEntitlementSummary.mockResolvedValue(summary({ remaining: 3, premiumRemaining: 3, companyRemaining: 1 }));
    render(<MyCreditsPanel email="a@b.com" />);
    expect(screen.getByText("a@b.com")).toBeTruthy();
    expect(await screen.findByText("3회")).toBeTruthy();
    expect(screen.getByText("1회")).toBeTruthy();
    expect(mocks.fetchEntitlementSummary).toHaveBeenCalledWith("t");
  });

  it("무료 1회가 남아 있으면 알려 준다", async () => {
    mocks.fetchEntitlementSummary.mockResolvedValue(summary({ remaining: 1, freeRemaining: 1 }));
    render(<MyCreditsPanel email={null} />);
    expect(await screen.findByText("무료 진단 1회가 남아 있어요")).toBeTruthy();
  });

  it("기업 분석이 꺼져 있으면 그 줄을 숨긴다", async () => {
    mocks.fetchEntitlementSummary.mockResolvedValue(summary({ remaining: 2, companyAnalysisEnabled: false }));
    render(<MyCreditsPanel email={null} />);
    await screen.findByText("2회");
    expect(screen.queryByText("기업 분석")).toBeNull();
  });

  it("못 불러오면 조용히 한 줄로 알린다", async () => {
    mocks.fetchEntitlementSummary.mockRejectedValue(new Error("x"));
    render(<MyCreditsPanel email={null} />);
    expect(await screen.findByText("이용권 정보를 불러오지 못했어요.")).toBeTruthy();
  });
});
