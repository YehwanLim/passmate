// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/googleIdentity", () => ({
  createSignInNonce: vi.fn().mockResolvedValue({ nonce: "n", hashedNonce: "h" }),
  loadGoogleIdentity: vi.fn().mockRejectedValue(new Error("no network")),
}));

import Login, { getSafeRedirectPath } from "./Login";

describe("Login page", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signInWithGoogle: vi.fn(),
      signInWithKakao: vi.fn(),
    });
  });
  afterEach(() => cleanup());

  it("일반 브라우저에서는 Google 과 카카오 버튼을 모두 보여 준다", async () => {
    render(<Login inAppBrowser={null} />);

    expect(await screen.findByRole("button", { name: "Google로 계속하기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeTruthy();
  });

  it("인앱 브라우저에서는 안내 카드와 카카오 버튼만 보여 준다", () => {
    render(<Login inAppBrowser="naver" />);

    expect(screen.getByText(/네이버 앱 안의 브라우저예요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Google로 계속하기" })).toBeNull();
  });
});

describe("getSafeRedirectPath", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  function withRedirect(value: string) {
    window.history.replaceState(null, "", `/login?redirect=${encodeURIComponent(value)}`);
    return getSafeRedirectPath();
  }

  it.each(["/analyze", "/my/new?x=1", "/account/deletion?pending=1"])("keeps the same-origin path %s", (path) => {
    expect(withRedirect(path)).toBe(path);
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/ /evil.com", "evil.com"])(
    "falls back to / for %s",
    (value) => {
      expect(withRedirect(value)).toBe("/");
    },
  );

  it("decodes %5C before checking, so an encoded backslash is refused too", () => {
    window.history.replaceState(null, "", "/login?redirect=/%5Cevil.com");
    expect(getSafeRedirectPath()).toBe("/");
  });
});
