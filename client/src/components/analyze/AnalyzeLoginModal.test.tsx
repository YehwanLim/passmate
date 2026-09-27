// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
// GIS 스크립트는 네트워크라 테스트에서 막는다. 로드 실패 → Google 버튼은 폴백 버튼으로 그려진다.
vi.mock("@/lib/googleIdentity", () => ({
  createSignInNonce: vi.fn().mockResolvedValue({ nonce: "n", hashedNonce: "h" }),
  loadGoogleIdentity: vi.fn().mockRejectedValue(new Error("no network")),
}));

import AnalyzeLoginModal from "./AnalyzeLoginModal";

describe("AnalyzeLoginModal", () => {
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
    render(<AnalyzeLoginModal open onClose={() => {}} inAppBrowser={null} />);

    expect(await screen.findByRole("button", { name: "Google로 계속하기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeTruthy();
    expect(screen.queryByText(/안의 브라우저예요/)).toBeNull();
  });

  it("인앱 브라우저에서는 Google 버튼 대신 안내 카드를 놓고 카카오 버튼만 남긴다", () => {
    render(<AnalyzeLoginModal open onClose={() => {}} inAppBrowser="threads" />);

    expect(screen.getByText(/스레드 안의 브라우저예요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Google로 계속하기" })).toBeNull();
    expect(screen.queryByText("로그인 준비 중...")).toBeNull();
  });
});
