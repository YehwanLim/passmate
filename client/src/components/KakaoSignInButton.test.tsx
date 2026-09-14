// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ useAuth: vi.fn(), signInWithKakao: vi.fn() }));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));

import KakaoSignInButton from "./KakaoSignInButton";

describe("KakaoSignInButton", () => {
  beforeEach(() => {
    mocks.signInWithKakao.mockReset().mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      signInWithKakao: mocks.signInWithKakao,
    });
  });
  afterEach(() => {
    cleanup();
  });

  it("runs the pre-redirect hook and then hands the login page redirect to Supabase", async () => {
    const onBeforeRedirect = vi.fn();
    render(<KakaoSignInButton redirectPath="/analyze" onBeforeRedirect={onBeforeRedirect} />);

    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    expect(onBeforeRedirect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mocks.signInWithKakao).toHaveBeenCalledTimes(1));
    expect(mocks.signInWithKakao).toHaveBeenCalledWith({
      redirectTo: `${window.location.origin}/login?redirect=%2Fanalyze`,
    });
    // 호출 순서: 초안 저장이 리다이렉트보다 먼저다.
    expect(onBeforeRedirect.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signInWithKakao.mock.invocationCallOrder[0]
    );
  });

  it("shows an error and re-enables the button when Supabase refuses", async () => {
    mocks.signInWithKakao.mockRejectedValue(new Error("provider is not enabled"));
    render(<KakaoSignInButton redirectPath="/" />);

    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    fireEvent.click(button);

    await waitFor(() =>
      expect(screen.getByText("카카오 로그인을 시작하지 못했어요. 다시 시도해 주세요.")).toBeTruthy()
    );
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("ignores a second click while the redirect is being prepared", async () => {
    let release: () => void = () => {};
    mocks.signInWithKakao.mockReturnValue(new Promise<void>(resolve => (release = resolve)));
    render(<KakaoSignInButton redirectPath="/" />);

    const button = screen.getByRole("button", { name: "카카오로 계속하기" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(mocks.signInWithKakao).toHaveBeenCalledTimes(1);
    release();
  });
});
