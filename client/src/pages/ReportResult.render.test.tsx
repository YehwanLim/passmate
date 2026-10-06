// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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

/** "더 자세히" 칸에 접혀 있는 줄의 제목(숫자 포함). */
function detailTitles() {
  return Array.from(document.querySelectorAll("#section-details h3 button > span > span:first-child")).map((title) => title.textContent);
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

  it("puts the summary first and folds posting fit into the details when the sample carries a job posting", async () => {
    window.history.replaceState({}, "", "/report-new?sample=1");

    render(<PassMateReport />);

    expect(await screen.findByText("채용 담당자에게 이렇게 읽혀요")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "잘 읽히는 점 3" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "고칠 점 3" })).toBeTruthy();
    // 요약에는 항목마다 ** 로 고른 핵심 문장만 싣는다.
    expect(screen.getByText("문제를 데이터로 좁히는 순서가 몸에 밴 지원자로 읽힙니다.")).toBeTruthy();
    expect(detailTitles()).toEqual(["예상 면접 질문5", "공고 적합도", "합격 기준", "다음 단계4", "실무자 코멘트"]);

    // 공고 적합도는 접혀 있다가 누르면 열린다.
    expect(screen.queryByText("현대자동차 · 서비스 기획 채용공고 기준")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /공고 적합도/ }));
    expect(screen.getByText("현대자동차 · 서비스 기획 채용공고 기준")).toBeTruthy();
    expect(screen.getByText("커넥티드카·모빌리티 서비스에 대한 이해")).toBeTruthy();
    expect(screen.getByText("없음")).toBeTruthy();
  });

  it("leaves posting fit out of the details for a stored report without it", async () => {
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

    expect(await screen.findByText("채용 담당자에게 이렇게 읽혀요")).toBeTruthy();
    expect(screen.getByText("지원자님 · 문항 2개")).toBeTruthy();
    expect(screen.getByRole("button", { name: "내 지원서" })).toBeTruthy();
    expect(detailTitles()).toEqual(["예상 면접 질문5", "합격 기준", "다음 단계4", "실무자 코멘트"]);
  });

  it("still keeps a real report id behind login", async () => {
    window.history.replaceState({}, "", "/report-new?analysisId=analysis-1");

    render(<PassMateReport />);

    expect(await screen.findByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.queryByText(/예시 리포트/)).toBeNull();
  });
});
