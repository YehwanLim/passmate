// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  navigate: vi.fn(),
  fetchEntitlementSummary: vi.fn(),
  createPurchaseIntent: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/entitlements", mocks.navigate],
  Link: ({ children }: { children?: unknown }) => children,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: mocks.useAuth,
}));

vi.mock("@/lib/entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlements")>()),
  fetchEntitlementSummary: mocks.fetchEntitlementSummary,
  createPurchaseIntent: mocks.createPurchaseIntent,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));

import Entitlements from "./Entitlements";

const SUMMARY = {
  premiumEnabled: true,
  freeRemaining: 0,
  premiumRemaining: 0,
  remaining: 0,
  groblePaymentUrl: "https://www.groble.im/payment/4SGBV5",
  grobleSinglePaymentUrl: "https://www.groble.im/payment/6HteWn",
  checkoutUrls: {
    single: "https://www.groble.im/payment/6HteWn",
    company: "https://www.groble.im/payment/CMP",
    standard: "https://www.groble.im/payment/4SGBV5",
    premium: "https://www.groble.im/payment/PRM",
    triple: null,
  },
  companyAnalysisEnabled: true,
  companyRemaining: 0,
  feedbackRewardClaimed: false,
};

function signedIn({ authLoading = false } = {}) {
  mocks.useAuth.mockReturnValue({
    isLoading: authLoading,
    isAuthenticated: !authLoading,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Entitlements purchase button", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mocks.fetchEntitlementSummary.mockResolvedValue(SUMMARY);
  });

  afterEach(() => cleanup());

  it("never tells a signed-in user that sales are unavailable while the summary is still loading", async () => {
    signedIn();
    // 요약 응답을 붙잡아 둔다 — 로딩 중 화면을 관찰하기 위해서다.
    mocks.fetchEntitlementSummary.mockReturnValue(new Promise(() => {}));

    render(<Entitlements />);

    expect(screen.queryAllByText(/판매를 준비하고 있어요/)).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: /스탠다드 구매하기/ }).length).toBeGreaterThan(0);
  });

  it("keeps the purchase button disabled until the checkout URL is known", async () => {
    signedIn();
    mocks.fetchEntitlementSummary.mockReturnValue(new Promise(() => {}));

    render(<Entitlements />);

    const button = screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0];
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("enables the button once the summary arrives", async () => {
    signedIn();
    render(<Entitlements />);

    await waitFor(() => {
      const button = screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0];
      expect(button.hasAttribute("disabled")).toBe(false);
    });
  });

  it("still says sales are unavailable when the server reports no checkout URL", async () => {
    signedIn();
    mocks.fetchEntitlementSummary.mockResolvedValue({
      ...SUMMARY,
      premiumEnabled: false,
      groblePaymentUrl: null,
      grobleSinglePaymentUrl: null,
      checkoutUrls: { single: null, company: null, standard: null, premium: null, triple: null },
    });

    render(<Entitlements />);

    await waitFor(() => {
      expect(screen.getAllByText(/판매를 준비하고 있어요/).length).toBeGreaterThan(0);
    });
  });

  it("opens the checkout tab in the click itself so the browser does not block the popup", async () => {
    signedIn();
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal("open", open);

    render(<Entitlements />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /자소서 진단 1회 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });

    screen.getAllByRole("button", { name: /자소서 진단 1회 구매하기/ })[0].click();

    // 클릭 핸들러가 await 를 거치기 전에 창을 연다 — 그래야 사용자 제스처로 인정된다.
    expect(open).toHaveBeenCalledWith("/checkout?product=single", "_blank");
    // 구매 의도 생성은 새 탭이 맡는다.
    expect(mocks.createPurchaseIntent).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("falls back to the current tab when the popup is blocked", async () => {
    signedIn();
    vi.stubGlobal("open", vi.fn().mockReturnValue(null));

    render(<Entitlements />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });

    screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0].click();

    expect(mocks.navigate).toHaveBeenCalledWith("/checkout?product=standard");
    vi.unstubAllGlobals();
  });

  it("sends a signed-out visitor to login instead of the checkout tab", async () => {
    mocks.useAuth.mockReturnValue({ isLoading: false, isAuthenticated: false });
    const open = vi.fn();
    vi.stubGlobal("open", open);

    render(<Entitlements />);

    screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0].click();

    expect(open).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/login"));
    vi.unstubAllGlobals();
  });

  it("switches the basic card to the company product and opens its checkout", async () => {
    signedIn();
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal("open", open);

    render(<Entitlements />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /자소서 진단 1회 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });

    screen.getByRole("radio", { name: /기업 분석 1회/ }).click();
    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /기업 분석 1회/ }).getAttribute("aria-checked")).toBe("true");
    });
    screen.getAllByRole("button", { name: /기업 분석 1회 구매하기/ })[0].click();

    expect(open).toHaveBeenCalledWith("/checkout?product=company", "_blank");
    vi.unstubAllGlobals();
  });

  it("opens the premium checkout from the premium card", async () => {
    signedIn();
    const open = vi.fn().mockReturnValue({});
    vi.stubGlobal("open", open);

    render(<Entitlements />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /프리미엄 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });
    screen.getAllByRole("button", { name: /프리미엄 구매하기/ })[0].click();

    expect(open).toHaveBeenCalledWith("/checkout?product=premium", "_blank");
    vi.unstubAllGlobals();
  });

  it("shows the preparing note only for products whose checkout URL is missing", async () => {
    signedIn();
    mocks.fetchEntitlementSummary.mockResolvedValue({
      ...SUMMARY,
      checkoutUrls: { ...SUMMARY.checkoutUrls, premium: null },
    });

    render(<Entitlements />);

    await waitFor(() => {
      expect(screen.getAllByText(/판매를 준비하고 있어요/)).toHaveLength(1);
      expect(screen.getAllByRole("button", { name: /스탠다드 구매하기/ })[0].hasAttribute("disabled")).toBe(false);
    });
  });

  it("gives the basic card the id the company deep link scrolls to", async () => {
    signedIn();
    render(<Entitlements />);

    expect(document.getElementById("basic")).not.toBeNull();
    expect(document.getElementById("standard")).not.toBeNull();
    expect(document.getElementById("premium")).not.toBeNull();
  });

  it("marks the standard card, and only that card, as recommended", async () => {
    signedIn();
    render(<Entitlements />);

    expect(document.getElementById("standard")?.textContent).toContain("추천");
    expect(document.getElementById("basic")?.textContent).not.toContain("추천");
    expect(document.getElementById("premium")?.textContent).not.toContain("추천");
  });

  it("preselects the company option when arriving at #company", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#company";
    try {
      signedIn();
      render(<Entitlements />);

      expect(screen.getByRole("radio", { name: /기업 분석 1회/ }).getAttribute("aria-checked")).toBe("true");
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      window.location.hash = "";
      // @ts-expect-error jsdom이 scrollIntoView를 구현하지 않아 스텁을 심었다 — 다른 테스트로 새지 않게 제거한다.
      delete Element.prototype.scrollIntoView;
    }
  });

  it("scrolls to the standard card for /entitlements#standard", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    window.location.hash = "#standard";
    try {
      signedIn();
      render(<Entitlements />);

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      expect(document.getElementById("standard")).not.toBeNull();
      // 베이직 선택은 기본값(자소서)에서 바뀌지 않는다.
      expect(screen.getByRole("radio", { name: /자소서 진단 1회/ }).getAttribute("aria-checked")).toBe("true");
    } finally {
      window.location.hash = "";
      // @ts-expect-error jsdom이 scrollIntoView를 구현하지 않아 스텁을 심었다 — 다른 테스트로 새지 않게 제거한다.
      delete Element.prototype.scrollIntoView;
    }
  });

  it("shows the preparing notice instead of a login button for tiers a guest cannot buy", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/entitlements?availability=1") {
        return jsonResponse({ companyAnalysisEnabled: false, purchasable: { single: true, company: false, standard: false, premium: false, triple: false } });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    }));
    render(<Entitlements />);
    await waitFor(() => expect(screen.getAllByText("현재 추가 이용권 판매를 준비하고 있어요.").length).toBeGreaterThanOrEqual(2));
    // 베이직(자소서 선택 기본값)은 살 수 있으므로 로그인으로 이어지는 구매 버튼이 남는다.
    expect(screen.getByRole("button", { name: "자소서 진단 1회 구매하기" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "프리미엄 구매하기" })).toBeNull();
    vi.unstubAllGlobals();
  });

  it("keeps login buttons when the availability request fails", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<Entitlements />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "프리미엄 구매하기" })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
