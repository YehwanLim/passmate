// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), useAuth: vi.fn() }));

vi.mock("wouter", () => ({
  useLocation: () => ["/login", mocks.navigate],
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/components/Logo", () => ({ default: () => null }));
vi.mock("@/components/MoodShiftBackground", () => ({ default: () => null }));
vi.mock("@/components/GoogleSignInButton", () => ({
  default: () => <button type="button">Google로 계속하기</button>,
}));

import Login from "./Login";

describe("Login", () => {
  afterEach(() => {
    cleanup();
    mocks.navigate.mockReset();
  });

  it("draws the card while the session is still being checked instead of a blank spinner", () => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
    render(<Login />);

    expect(screen.getByRole("heading", { name: "시작하기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeTruthy();
    expect(screen.getByText("자소서는 분석에만 쓰이고, AI 학습에 사용되지 않습니다.")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("sends an already logged-in visitor on to the redirect target", () => {
    window.history.replaceState({}, "", "/login?redirect=%2Fanalyze");
    mocks.useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    render(<Login />);

    expect(mocks.navigate).toHaveBeenCalledWith("/analyze");
  });
});
