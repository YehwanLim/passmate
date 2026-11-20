// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(),
  fetchEntitlementSummary: vi.fn(),
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
vi.mock("@/lib/entitlements", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/entitlements")>()),
  fetchEntitlementSummary: mocks.fetchEntitlementSummary,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
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
    // 남은 이용권은 계정 정보라 로그인 전엔 보이지 않는다
    expect(screen.queryByText(/남은 이용권/)).toBeNull();

    expect(screen.getByPlaceholderText("여기에 답변을 작성해 주세요.")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalledWith(expect.stringContaining("/login"));
    // 이전 지원서는 계정 데이터라 로그인 전엔 숨긴다.
    expect(screen.queryByText("이전 지원서 불러오기")).toBeNull();
  });

  it("shows the remaining essay credits in the side notes once logged in", async () => {
    mocks.useAuth.mockReturnValue(LOGGED_IN);
    mocks.fetchEntitlementSummary.mockResolvedValue({ freeRemaining: 1, remaining: 3 });
    render(<Analyze />);
    const credit = await screen.findByText(/남은 이용권/);
    expect(credit.textContent).toBe("남은 이용권 3회");
  });

  it("asks for login at submit without sending anything and keeps what was typed", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<Analyze />);

    const answer = screen.getByPlaceholderText("여기에 답변을 작성해 주세요.") as HTMLTextAreaElement;
    fireEvent.change(answer, { target: { value: LONG_ANSWER } });
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));

    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(answer.value).toBe(LONG_ANSWER);
  });

  it("closes the prompt once the visitor logs in and submits for them, since they already pressed 분석 시작", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    const view = render(<Analyze />);
    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), {
      target: { value: LONG_ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();

    mocks.useAuth.mockReturnValue(LOGGED_IN);
    view.rerender(<Analyze />);

    // 모달은 퇴장 애니메이션 뒤에 사라진다.
    await waitFor(() => expect(screen.queryByText("로그인이 필요해요")).toBeNull());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/analyze");
    expect(
      (screen.getByPlaceholderText("여기에 답변을 작성해 주세요.") as HTMLTextAreaElement).value
    ).toBe(LONG_ANSWER);
  });

  it("does not submit on login when the visitor had closed the prompt", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    const view = render(<Analyze />);
    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), {
      target: { value: LONG_ANSWER },
    });
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    mocks.useAuth.mockReturnValue(LOGGED_IN);
    view.rerender(<Analyze />);

    await waitFor(() => expect(screen.queryByText("로그인이 필요해요")).toBeNull());
    expect(fetchSpy).not.toHaveBeenCalled();
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
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    const stored = JSON.parse(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY) ?? "null");
    expect(stored?.questions?.[0]?.answer).toBe(LONG_ANSWER);
    // 돌아오면 제출을 대신 누르라는 표시. 모달은 "분석 시작"을 눌러야만 뜨므로 항상 참이다.
    expect(stored?.submitOnReturn).toBe(true);
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

  it("submits right away after the Kakao round-trip when the draft says 분석 시작 was already pressed", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetchSpy);
    window.sessionStorage.setItem(
      ANALYZE_DRAFT_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        company: "토스",
        jobRole: "PM",
        questions: [{ id: "q1", question: "지원 동기", answer: LONG_ANSWER }],
        jobPosting: null,
        submitOnReturn: true,
      })
    );
    mocks.useAuth.mockReturnValue(LOGGED_IN);
    render(<Analyze />);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/analyze");
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.company).toBe("토스");
    // 제출 본문은 sanitizeText 를 거쳐 앞뒤 공백이 정리된다.
    expect(body.questions[0].answer).toBe(LONG_ANSWER.trim());
  });

  it("does not submit after the round-trip when the draft was saved without that flag", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
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

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// 면접 후기 글의 입구(/analyze?company=...&intent=interview). intent 는 서버로 보내지 않고, 폼 안내와 리포트 첫 위치만 바꾼다.
describe("Analyze interview intent", () => {
  const NOTICE = "이미 낸 자소서를 그대로 넣으면 돼요. 리포트에서 예상 질문부터 보여 드릴게요.";
  const RECEIPT = {
    analysis_request_id: "req-1",
    analysis_id: "an-1",
    project_id: "p-1",
    requestId: "rid-1",
    status: "PENDING",
  };

  beforeEach(() => {
    mocks.useAuth.mockReturnValue(LOGGED_OUT);
    mocks.navigate.mockReset();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("shows the one-line notice only when the visitor came with intent=interview", () => {
    window.history.replaceState({}, "", `/analyze?company=${encodeURIComponent("삼성전자")}&intent=interview`);
    render(<Analyze />);
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(screen.getByDisplayValue("삼성전자")).toBeTruthy();
    cleanup();

    window.history.replaceState({}, "", "/analyze?intent=somethingelse");
    render(<Analyze />);
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it("keeps intent across the Kakao redirect in both the return path and the stashed draft", async () => {
    const signInWithKakao = vi.fn().mockResolvedValue(undefined);
    mocks.useAuth.mockReturnValue({ ...LOGGED_OUT, signInWithKakao });
    window.history.replaceState({}, "", "/analyze?intent=interview");
    render(<Analyze />);

    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), { target: { value: LONG_ANSWER } });
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));
    fireEvent.click(screen.getByRole("button", { name: "카카오로 계속하기" }));

    const stored = JSON.parse(window.sessionStorage.getItem(ANALYZE_DRAFT_KEY) ?? "null");
    expect(stored?.intent).toBe("interview");
    await waitFor(() => expect(signInWithKakao).toHaveBeenCalledTimes(1));
    expect(signInWithKakao).toHaveBeenCalledWith({
      redirectTo: `${window.location.origin}/login?redirect=${encodeURIComponent("/analyze?intent=interview")}`,
    });
  });

  it("restores intent from the draft after the round-trip and carries it to /analysis-pending", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(RECEIPT), { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);
    window.sessionStorage.setItem(
      ANALYZE_DRAFT_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        company: "삼성전자",
        jobRole: "마케팅",
        questions: [{ id: "q1", question: "지원 동기", answer: LONG_ANSWER }],
        jobPosting: null,
        submitOnReturn: true,
        intent: "interview",
      })
    );
    // 주소에 intent 가 없어도(초안만 남은 경우) 초안이 잇는다.
    window.history.replaceState({}, "", "/analyze");
    mocks.useAuth.mockReturnValue(LOGGED_IN);
    render(<Analyze />);

    expect(screen.getByText(NOTICE)).toBeTruthy();
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/analysis-pending?requestId=req-1&intent=interview"));
    // 서버로 가는 분석 입력에는 intent 가 없다 — 분석·크레딧은 평소와 같다.
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).not.toHaveProperty("intent");
  });

  it("keeps intent in memory through the in-page (Google) login and carries it to /analysis-pending", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(RECEIPT), { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);
    window.history.replaceState({}, "", "/analyze?intent=interview");
    const view = render(<Analyze />);
    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), { target: { value: LONG_ANSWER } });
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));

    mocks.useAuth.mockReturnValue(LOGGED_IN);
    view.rerender(<Analyze />);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/analysis-pending?requestId=req-1&intent=interview"));
  });

  it("goes to /analysis-pending without intent for an ordinary visit", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(RECEIPT), { status: 202 }));
    vi.stubGlobal("fetch", fetchSpy);
    window.history.replaceState({}, "", "/analyze");
    mocks.useAuth.mockReturnValue(LOGGED_IN);
    render(<Analyze />);
    fireEvent.change(screen.getByPlaceholderText("여기에 답변을 작성해 주세요."), { target: { value: LONG_ANSWER } });
    fireEvent.click(screen.getByRole("button", { name: "자소서 분석하기" }));

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/analysis-pending?requestId=req-1"));
  });
});
