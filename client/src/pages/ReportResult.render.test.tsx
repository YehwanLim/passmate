// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

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

/** 왼쪽 목차 항목(번호 + 이름). */
function navTexts() {
  return within(screen.getByRole("navigation", { name: "리포트 목차" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
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

  it("renders every section of the sample in report order, posting fit included", async () => {
    window.history.replaceState({}, "", "/report-new?sample=1");

    render(<PassMateReport />);

    // 01 첫인상: 이름표(페르소나·지원자 프로필) 아래 읽는 순서 3초·10초(기억할 모습 ✓)·30초(남는 질문 △).
    expect(await screen.findByText("김민지님은 채용 담당자에게 이렇게 읽혀요")).toBeTruthy();
    expect(screen.getByText("채용 담당자가 읽는 순서대로")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "채용담당자가 기억할 모습" })).getByText("로그 3,000건을 직접 모은 동아리 기획자")).toBeTruthy();
    expect(screen.getByText("다 읽고 남는 질문")).toBeTruthy();
    expect(screen.getByText("지원자 프로필")).toBeTruthy();
    // 02 핵심 진단: 강점·보완점 전문과 합격까지의 거리(아쉬운 부분까지).
    expect(screen.getByRole("heading", { name: "이 자소서는 이렇게 읽히고 있어요" })).toBeTruthy();
    expect(screen.getByText("문제를 데이터로 좁히는 순서가 몸에 밴 지원자로 읽힙니다.").tagName).toBe("STRONG");
    expect(screen.getByText("지금 가장 아쉬운 부분")).toBeTruthy();
    expect(navTexts()).toEqual([
      "01.첫인상",
      "02.합격 기준",
      "03.공고 적합도",
      "04.핵심 진단",
      "05.문장별 코멘트",
      "06.예상 질문",
      "07.다음 단계",
      "08.실무자 코멘트",
    ]);

    // 공고 적합도는 블록째 펼쳐 둔다.
    expect(screen.getByRole("heading", { name: "공고가 원하는 것을 자소서가 얼마나 채웠는지 봤어요" })).toBeTruthy();
    expect(screen.getByText("현대자동차 · 서비스 기획 채용공고 기준")).toBeTruthy();
    expect(screen.getByText("커넥티드카·모빌리티 서비스에 대한 이해")).toBeTruthy();
    expect(screen.getByText("안 보여요")).toBeTruthy();
  });

  it("leaves posting fit out for a stored report without it", async () => {
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

    expect(await screen.findByText("지원자님은 채용 담당자에게 이렇게 읽혀요")).toBeTruthy();
    expect(screen.getByText("지원자님 · 문항 2개")).toBeTruthy();
    expect(screen.getByRole("button", { name: "내 지원서" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "공고가 원하는 것을 자소서가 얼마나 채웠는지 봤어요" })).toBeNull();
    expect(navTexts()).toEqual([
      "01.첫인상",
      "02.합격 기준",
      "03.핵심 진단",
      "04.문장별 코멘트",
      "05.예상 질문",
      "06.다음 단계",
      "07.실무자 코멘트",
    ]);
  });

  it("still keeps a real report id behind login", async () => {
    window.history.replaceState({}, "", "/report-new?analysisId=analysis-1");

    render(<PassMateReport />);

    expect(await screen.findByText("로그인이 필요해요")).toBeTruthy();
    expect(screen.queryByText(/예시 리포트/)).toBeNull();
  });
});
