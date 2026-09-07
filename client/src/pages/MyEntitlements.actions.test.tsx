// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  navigate: vi.fn(),
  fetchEntitlementSummary: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/my/entitlements", mocks.navigate],
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlements")>()),
  fetchEntitlementSummary: mocks.fetchEntitlementSummary,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));

import MyEntitlements from "./MyEntitlements";

const BASE_SUMMARY = {
  premiumEnabled: true,
  freeRemaining: 0,
  bonusRemaining: 0,
  premiumRemaining: 0,
  remaining: 0,
  groblePaymentUrl: null,
  grobleSinglePaymentUrl: null,
  checkoutUrls: {
    single: null,
    company: null,
    standard: null,
    premium: null,
    triple: null,
  },
  companyAnalysisEnabled: true,
  companyRemaining: 0,
  feedbackRewardClaimed: false,
};

/** 흰 배경 = 주 버튼. 위계를 클래스로 판별한다. */
function isPrimary(button: HTMLElement) {
  return button.className.includes("bg-white text-black");
}

async function renderWith(summary: Partial<typeof BASE_SUMMARY>) {
  mocks.fetchEntitlementSummary.mockResolvedValue({
    ...BASE_SUMMARY,
    ...summary,
  });
  render(<MyEntitlements />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "자소서 분석하기" })).toBeTruthy()
  );
}

describe("MyEntitlements action buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      user: { id: "user-1" },
      isLoading: false,
      isAuthenticated: true,
    });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } },
    });
  });

  afterEach(() => cleanup());

  it("promotes going to analysis when essay credit is left", async () => {
    await renderWith({ remaining: 2, freeRemaining: 1, premiumRemaining: 1 });

    expect(isPrimary(screen.getByRole("button", { name: "자소서 분석하기" }))).toBe(true);
    expect(isPrimary(screen.getByRole("button", { name: "이용권 구매하기" }))).toBe(false);

    screen.getByRole("button", { name: "자소서 분석하기" }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/analyze");
  });

  it("promotes purchasing when every credit pool is empty", async () => {
    await renderWith({ remaining: 0, companyRemaining: 0 });

    expect(isPrimary(screen.getByRole("button", { name: "이용권 구매하기" }))).toBe(true);
    expect(isPrimary(screen.getByRole("button", { name: "자소서 분석하기" }))).toBe(false);

    screen.getByRole("button", { name: "이용권 구매하기" }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/entitlements");
  });

  it("shows the company entry only with a sellable company credit", async () => {
    await renderWith({ companyRemaining: 1 });

    screen.getByRole("button", { name: "기업 분석하기" }).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/company-analysis");
    // 기업 크레딧이 남아 있으면 구매를 주 버튼으로 올리지 않는다.
    expect(isPrimary(screen.getByRole("button", { name: "이용권 구매하기" }))).toBe(false);
  });

  it("hides the company entry when company analysis is switched off", async () => {
    await renderWith({ companyAnalysisEnabled: false, companyRemaining: 1 });

    expect(screen.queryByRole("button", { name: "기업 분석하기" })).toBeNull();
  });
});
