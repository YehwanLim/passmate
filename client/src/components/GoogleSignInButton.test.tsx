// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  signInWithGoogle: vi.fn(),
  sendClientEvent: vi.fn(),
  loadGoogleIdentity: vi.fn(),
  signInWithIdToken: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/siteVisits", () => ({ sendClientEvent: mocks.sendClientEvent }));
vi.mock("@/lib/googleIdentity", () => ({
  createSignInNonce: vi.fn().mockResolvedValue({ nonce: "n", hashedNonce: "h" }),
  loadGoogleIdentity: mocks.loadGoogleIdentity,
}));
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { signInWithIdToken: mocks.signInWithIdToken } } }));

import GoogleSignInButton from "./GoogleSignInButton";

describe("GoogleSignInButton — 실패 기록", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-id");
    mocks.sendClientEvent.mockReset().mockResolvedValue(true);
    mocks.signInWithGoogle.mockReset().mockResolvedValue(undefined);
    mocks.signInWithIdToken.mockReset().mockResolvedValue({ error: null });
    mocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signInWithGoogle: mocks.signInWithGoogle,
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("GIS 스크립트를 못 받으면 폴백 버튼으로 바꾸면서 그 사실을 서버에 남긴다", async () => {
    mocks.loadGoogleIdentity.mockRejectedValue(new Error("script blocked"));
    render(<GoogleSignInButton redirectPath="/analyze" />);

    expect(await screen.findByRole("button", { name: "Google로 계속하기" })).toBeTruthy();
    expect(mocks.sendClientEvent).toHaveBeenCalledWith("google_button_unavailable", "script blocked");
  });

  it("폴백 로그인 시작이 실패하면 오류를 보여 주고 서버에 남긴다", async () => {
    mocks.loadGoogleIdentity.mockRejectedValue(new Error("script blocked"));
    mocks.signInWithGoogle.mockRejectedValue(new Error("popup closed"));
    render(<GoogleSignInButton redirectPath="/analyze" />);

    fireEvent.click(await screen.findByRole("button", { name: "Google로 계속하기" }));

    await waitFor(() => expect(screen.getByText("popup closed")).toBeTruthy());
    expect(mocks.sendClientEvent).toHaveBeenCalledWith("google_signin_failed", "popup closed");
  });

  it("GIS 토큰을 Supabase 가 거절하면 오류를 보여 주고 서버에 남긴다", async () => {
    let gisCallback: ((response: { credential: string }) => Promise<void>) | null = null;
    mocks.loadGoogleIdentity.mockResolvedValue({
      initialize: ({ callback }: { callback: typeof gisCallback }) => { gisCallback = callback; },
      renderButton: () => {},
    });
    mocks.signInWithIdToken.mockResolvedValue({ error: { message: "Invalid nonce" } });
    render(<GoogleSignInButton redirectPath="/analyze" />);

    await waitFor(() => expect(gisCallback).not.toBeNull());
    await gisCallback!({ credential: "jwt" });

    await waitFor(() => expect(screen.getByText(/로그인 처리 중 오류/)).toBeTruthy());
    expect(mocks.sendClientEvent).toHaveBeenCalledWith("google_signin_failed", "Invalid nonce");
  });
});
