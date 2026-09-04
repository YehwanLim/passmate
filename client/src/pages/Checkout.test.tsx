// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  createPurchaseIntent: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/checkout", mocks.navigate],
}));

vi.mock("@/lib/entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlements")>()),
  createPurchaseIntent: mocks.createPurchaseIntent,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock("@/components/Logo", () => ({ default: () => null }));

import Checkout from "./Checkout";

const CHECKOUT_URL = "https://www.groble.im/payment/6HteWn?ref=intent-1";

const realLocation = window.location;
const replace = vi.fn();

// jsdom 은 location.replace 스파이를 막는다 — location 자체를 갈아끼운다.
function visit(search: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { search, replace, href: `/checkout${search}` },
  });
}

describe("Checkout redirect page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replace.mockClear();
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
    mocks.createPurchaseIntent.mockResolvedValue({
      purchaseIntentId: "intent-1",
      checkoutUrl: CHECKOUT_URL,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: realLocation,
    });
  });

  it("creates the purchase intent for the requested product and sends the tab to Groble", async () => {
    visit("?product=single");

    render(<Checkout />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith(CHECKOUT_URL));
    expect(mocks.createPurchaseIntent).toHaveBeenCalledWith("t", "single");
  });

  it("cuts the opener loose before handing the tab to the payment page", async () => {
    visit("?product=triple");
    window.opener = { hijack: true };

    render(<Checkout />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    expect(window.opener).toBeNull();
  });

  it("refuses an unknown product without calling the server", async () => {
    visit("?product=quintuple");

    render(<Checkout />);

    await waitFor(() => {
      expect(screen.getByText(/이용권 정보를 확인하지 못했어요/)).toBeTruthy();
    });
    expect(mocks.createPurchaseIntent).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends a visitor without a session to login", async () => {
    visit("?product=single");
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(<Checkout />);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith(expect.stringContaining("/login"));
    });
    expect(mocks.createPurchaseIntent).not.toHaveBeenCalled();
  });

  it("offers a way back when the purchase cannot be started", async () => {
    visit("?product=triple");
    mocks.createPurchaseIntent.mockRejectedValue(new Error("boom"));

    render(<Checkout />);

    await waitFor(() => {
      expect(screen.getByText(/결제 페이지를 열지 못했어요/)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /다시 시도/ })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("tells the visitor what is happening while it waits", async () => {
    visit("?product=single");
    mocks.createPurchaseIntent.mockReturnValue(new Promise(() => {}));

    render(<Checkout />);

    await waitFor(() => {
      expect(screen.getByText(/결제 페이지로 이동하고 있어요/)).toBeTruthy();
    });
  });
});
