// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/report-new", mocks.navigate],
  useSearch: () => window.location.search,
  Link: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));
// 로그인 상태 리포트의 피드백 보상 훅이 세션을 읽는다. 테스트에서는 세션 없음으로 둔다.
vi.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));

import { RESUME_REPORT_SAMPLE } from "@/constants/resumeReportSample";
import PassMateReport from "./ReportResult";

/** 상단 sticky 칩 바의 칩들(data-section). 좌측 목차(MiniNavigator)는 data-section 이 없어 섞이지 않는다. */
function chipTexts() {
  return Array.from(document.querySelectorAll("[data-section]")).map((chip) => chip.textContent);
}

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

  it("shows the posting-fit section as 03 and renumbers the rest when the sample carries a job posting", async () => {
    window.history.replaceState({}, "", "/report-new?sample=1");

    render(<PassMateReport />);

    expect(await screen.findByRole("heading", { name: /이 공고에 이 자소서를 놓으면/ })).toBeTruthy();
    expect(screen.getByText("현대자동차 · 서비스 기획 채용공고 기준")).toBeTruthy();
    expect(screen.getByText("커넥티드카·모빌리티 서비스에 대한 이해")).toBeTruthy();
    expect(screen.getByText("언급 없음")).toBeTruthy();
    expect(chipTexts()).toEqual([
      "01첫인상",
      "02합격 기준",
      "03공고 적합도",
      "04핵심 진단",
      "05문장 분석",
      "06예상 질문",
      "07다음 단계",
      "08실무자 코멘트",
    ]);
  });

  it("keeps the 7-section layout for a stored report without posting fit", async () => {
    window.history.replaceState({}, "", "/report-new?analysisId=analysis-1");
    mocks.useAuth.mockReturnValue({ user: { name: "지원자" }, isLoading: false, isAuthenticated: true });
    mocks.getAuthorizationHeader.mockResolvedValue({});
    const { postingFit: _omitted, ...legacyReport } = RESUME_REPORT_SAMPLE.report;
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "analysis-1",
        kind: "RESUME",
        company_name: "현대자동차",
        job_role: "서비스 기획",
        ai_response_json: legacyReport,
        job_posting: null,
      }),
    })));

    render(<PassMateReport />);

    expect(await screen.findByRole("heading", { name: /이 자소서는 이렇게 읽히고 있어요/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /이 공고에 이 자소서를 놓으면/ })).toBeNull();
    expect(chipTexts()).toEqual([
      "01첫인상",
      "02합격 기준",
      "03핵심 진단",
      "04문장 분석",
      "05예상 질문",
      "06다음 단계",
      "07실무자 코멘트",
    ]);
  });

  it("still keeps a real report id behind login", async () => {
    window.history.replaceState({}, "", "/report-new?analysisId=analysis-1");

    render(<PassMateReport />);

    expect(await screen.findByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.queryByText(/예시 리포트/)).toBeNull();
  });
});
