// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/analyze", mocks.navigate],
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));
// GIS 스크립트를 부르지 않도록 버튼만 스텁. 실제 로그인은 AuthContext 가 isAuthenticated 로 알린다.
vi.mock("@/components/GoogleSignInButton", () => ({
  default: () => <button type="button">Google로 계속하기</button>,
}));

import Analyze from "./Analyze";
import { ANALYZE_DRAFT_KEY } from "@/lib/analyzeDraft";

const LOGGED_OUT = { user: null, isLoading: false, isAuthenticated: false };
const LOGGED_IN = {
  user: { id: "u1", email: "a@b.c", name: "지원자" },
  isLoading: false,
  isAuthenticated: true,
};
// 1,000자 이상이면 "짧아요" 확인 모달 없이 바로 제출 단계로 간다.
const LONG_ANSWER = "데이터로 문제를 찾고 실행까지 옮긴 경험을 적었습니다. ".repeat(40);

describe("Analyze login prompt", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue(LOGGED_OUT);
    mocks.navigate.mockReset();
    window.history.replaceState({}, "", "/analyze");
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the form to logged-out visitors instead of bouncing them to /login", () => {
    render(<Analyze />);

    expect(screen.getByPlaceholderText("여기에 답변을 작성해 주세요.")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalledWith(expect.stringContaining("/login"));
    // 이전 지원서는 계정 데이터라 로그인 전엔 숨긴다.
    expect(screen.queryByText("이전 지원서 불러오기")).toBeNull();
  });

  it("asks for login at submit without sending anything and keeps what was typed", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Analyze />);

    const answer = screen.getByPlaceholderText("여기에 답변을 작성해 주세요.") as HTMLTextAreaElement;
    fireEvent.change(answer, { target: { value: LONG_ANSWER } });
    fireEvent.click(screen.getByRole("button", { name: "분석 시작" }));

    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(answer.value).toBe(LONG_ANSWER);
  });

  it("closes the prompt once the visitor logs in, leaving the submit to them", async () => {
    const view = render(<Analyze />);
    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), {
      target: { value: LONG_ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: "분석 시작" }));
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();

    mocks.useAuth.mockReturnValue(LOGGED_IN);
    view.rerender(<Analyze />);

    // 모달은 퇴장 애니메이션 뒤에 사라진다.
    await waitFor(() => expect(screen.queryByText("로그인이 필요해요")).toBeNull());
    expect(
      (screen.getByPlaceholderText("여기에 답변을 작성해 주세요.") as HTMLTextAreaElement).value
    ).toBe(LONG_ANSWER);
  });

  // 카카오는 전체 페이지 리다이렉트라 메모리의 폼이 사라진다. 떠나기 전에 초안을 sessionStorage 에 남긴다.
  it("stashes the draft before the Kakao redirect leaves the page", async () => {
    const signInWithKakao = vi.fn().mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({ ...LOGGED_OUT, signInWithKakao });
    window.sessionStorage.clear();
    render(<Analyze />);

    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), {
      target: { value: LONG_ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: "분석 시작" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    const stored = JSON.parse(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY) ?? "null");
    expect(stored?.questions?.[0]?.answer).toBe(LONG_ANSWER);
    await waitFor(() => expect(signInWithKakao).toHaveBeenCalledTimes(1));
    expect(signInWithKakao).toHaveBeenCalledWith({
      redirectTo: `${window.location.origin}/login?redirect=%2Fanalyze`,
    });
    window.sessionStorage.clear();
  });

  it("restores the stashed draft when the visitor comes back from the Kakao round-trip", () => {
    window.sessionStorage.setItem(
      ANALYZE_DRAFT_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        company: "토스",
        jobRole: "PM",
        questions: [{ id: "q1", question: "지원 동기", answer: LONG_ANSWER }],
        jobPosting: null,
      })
    );
    mocks.useAuth.mockReturnValue(LOGGED_IN);
    render(<Analyze />);

    expect(
      (screen.getByPlaceholderText("여기에 답변을 작성해 주세요.") as HTMLTextAreaElement).value
    ).toBe(LONG_ANSWER);
    expect(screen.getByDisplayValue("토스")).toBeTruthy();
    expect(screen.getByDisplayValue("PM")).toBeTruthy();
    // 한 번 복원한 초안은 지워서, 새로 들어온 방문을 옛 초안이 덮지 않게 한다.
    expect(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY)).toBeNull();
  });
});
