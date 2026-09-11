// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/report-new", mocks.navigate], Link: ({ children }: { children: unknown }) => children }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));

import PassMateReport from "./ReportResult";

describe("ReportResult public sample", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    // 스크롤 스파이용 IntersectionObserver 가 jsdom 에 없다.
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
    // 문장 분석 섹션이 모바일 레이아웃 판단에 matchMedia 를 쓴다. jsdom 에는 없다.
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("renders the whole sample without login and without fetching", async () => {
    window.history.replaceState({}, "", "/report-new?sample=1");
    const fetchSpy = vi.fn(async () => { throw new Error("sample must not fetch"); });
    vi.stubGlobal("fetch", fetchSpy);

    render(<PassMateReport />);

    expect(await screen.findByText(/예시 리포트/)).toBeTruthy();
    expect(screen.getByText(/가상의 지원자 김민지님/)).toBeTruthy();
    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
    // 비로그인에게 잠기던 뒤쪽 섹션(예상 질문·실무자 코멘트)까지 보인다.
    expect(screen.getByText("현대자동차의 커넥티드 서비스를 개선한다면 어떤 데이터를 가장 먼저 보겠습니까?")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /내 자소서 분석하기/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "내 지원서" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still keeps a real report id behind login", async () => {
    window.history.replaceState({}, "", "/report-new?analysisId=analysis-1");

    render(<PassMateReport />);

    expect(await screen.findByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.queryByText(/예시 리포트/)).toBeNull();
  });
});
