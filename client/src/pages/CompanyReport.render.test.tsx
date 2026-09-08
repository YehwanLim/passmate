// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { buildCompanyReportFixture } from "./companyReportFixture";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/company-report", mocks.navigate], Link: ({ children }: { children: unknown }) => children }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/Logo", () => ({ default: () => null }));

import CompanyReport, { heroTitleSizeClass } from "./CompanyReport";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("heroTitleSizeClass", () => {
  it("steps the cover headline down when the model overshoots the 28-character limit", () => {
    expect(heroTitleSizeClass("전동화로 체급을 바꾸는 완성차")).toContain("md:text-[4.05rem]");
    expect(heroTitleSizeClass("반도체와 AI 기반 스마트 기기로 글로벌 시장을 선도하는 기업")).toContain("md:text-[3.4rem]");
    expect(heroTitleSizeClass("메모리 반도체와 스마트폰을 기반으로 AI, 파운드리, 전장 등 미래 기술을 선도하는 기업")).toContain("md:text-[3rem]");
    // 강조 마커는 글자 수에 넣지 않는다.
    expect(heroTitleSizeClass("**전동화로 체급을 바꾸는 완성차**")).toContain("md:text-[4.05rem]");
  });
});

describe("CompanyReport", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({ user: { id: "u1", email: "a@b.c", name: "지원자" }, isLoading: false, isAuthenticated: true });
    mocks.getAuthorizationHeader.mockResolvedValue({ Authorization: "Bearer token" });
    window.history.replaceState({}, "", "/company-report?analysisId=analysis-1");
    // 스크롤 스파이용 IntersectionObserver 가 jsdom 에 없다.
    vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} unobserve() {} });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("renders the eight sections, the appendix with every source, and the disclaimers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      id: "analysis-1", kind: "COMPANY", ai_response_json: buildCompanyReportFixture(),
      company_name: "현대자동차", job_role: "전략기획",
    })));

    render(<CompanyReport />);

    await waitFor(() => expect(screen.getByText("전동화로 체급을 바꾸는 완성차")).toBeTruthy());
    for (const heading of ["무엇을 팔아 돈을 버나", "요즘 힘을 싣는 사업", "매출·이익·주가 한눈에", "최근 1년 주요 이슈", "지원 직무가 하는 일 · 전략기획", "회사의 기회와 걱정거리", "자소서에 쓸 사업 소재", "면접 예상 질문과 읽을 자료", "출처와 기준일"]) {
      expect(screen.getAllByText(heading, { exact: false }).length).toBeGreaterThan(0);
    }
    // 목차(미니 내비)는 짧은 키워드형 라벨을 쓴다.
    for (const label of ["사업 구조", "집중 사업", "실적과 주가", "최근 이슈", "직무의 역할", "기회와 위험", "자소서 소재", "면접 준비"]) {
      expect(screen.getAllByText(label, { exact: false }).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("hyundai.com")).toBeTruthy();
    expect(screen.getByText("dart.fss.or.kr")).toBeTruthy();
    expect(screen.getByText(/투자 조언이 아닙니다/)).toBeTruthy();
    // 기준일은 표지와 부록 두 곳에 나온다.
    expect(screen.getAllByText(/기준일 2026-09-06/).length).toBeGreaterThan(0);
    // 검색 제안 칩은 그대로 렌더된다(Google 약관).
    expect(document.querySelector('a[href="https://vertexaisearch.cloud.google.com/x"]')).toBeTruthy();
    // 항목별 각주 칩은 없다(스펙 §7-1).
    expect(screen.queryByText("[1]")).toBeNull();
    // 화면 조회 전용: 다운로드·인쇄 없음.
    expect(screen.queryByText(/저장|다운로드|인쇄|PDF/)).toBeNull();
  });

  it("shows what each source backed and hides the search provider's redirect host as publisher", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
      id: "analysis-1", kind: "COMPANY", company_name: "현대자동차", job_role: "전략기획",
      ai_response_json: buildCompanyReportFixture({
        sources: [
          { id: 1, title: "hyundai.com", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a", publisher: "hyundai.com", excerpt: "(2026-07) 전동화 투자를 2배로 늘렸다." },
          { id: 2, title: "dart.fss.or.kr", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b", publisher: "vertexaisearch.cloud.google.com", excerpt: null },
        ],
      }),
    })));

    render(<CompanyReport />);

    await waitFor(() => expect(screen.getByText("(2026-07) 전동화 투자를 2배로 늘렸다.")).toBeTruthy());
    expect(screen.queryByText(/vertexaisearch\.cloud\.google\.com/)).toBeNull();
    expect(screen.getByText("dart.fss.or.kr")).toBeTruthy();
  });

  it("sends a résumé analysis id to the résumé report instead of rendering it here", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "analysis-2", kind: "RESUME", ai_response_json: { questionTabs: [] } })));

    render(<CompanyReport />);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/report-new?analysisId=analysis-2"));
  });

  it("shows a readable error when the stored report is not renderable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "analysis-3", kind: "COMPANY", ai_response_json: { brief: {} } })));

    render(<CompanyReport />);

    await waitFor(() => expect(screen.getByText("저장된 기업 분석 리포트 형식이 올바르지 않습니다.")).toBeTruthy());
  });

  it("renders a report whose optional arrays are missing instead of crashing", async () => {
    const sparse = buildCompanyReportFixture();
    // 모델이 일부 배열을 빼먹은 응답을 흉내 낸다. 가드는 통과하고 화면은 빈 블록으로 버텨야 한다.
    const payload = {
      ...sparse,
      brief: { oneLiner: sparse.brief.oneLiner, asOf: "2026-09-06", positionInIndustry: "" },
      focusBusinesses: { statedDirection: "", items: [] },
      financialSnapshot: { listed: false, market: null, revenueTrend: "", profitTrend: "", marketView: "", fundingNote: "", forApplicant: "" },
      roleInContext: { whereItSits: "", whyHiringNow: "", postingReading: "" },
      interviewPrep: { questions: [] },
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ id: "analysis-4", kind: "COMPANY", ai_response_json: payload, company_name: "현대자동차", job_role: "전략기획" })));

    render(<CompanyReport />);

    await waitFor(() => expect(screen.getByText("전동화로 체급을 바꾸는 완성차")).toBeTruthy());
    expect(screen.getAllByText("출처와 기준일", { exact: false }).length).toBeGreaterThan(0);
  });

  it("asks unauthenticated visitors to log in", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    render(<CompanyReport />);
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
  });

  it("renders the public sample without login and without fetching", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    window.history.replaceState({}, "", "/company-report?sample=1");
    const fetchSpy = vi.fn(async () => { throw new Error("sample must not fetch"); });
    vi.stubGlobal("fetch", fetchSpy);
    render(<CompanyReport />);
    expect(await screen.findByText(/샘플 리포트/)).toBeTruthy();
    expect(screen.queryByText("로그인이 필요해요")).toBeNull();
    expect(screen.getByRole("button", { name: /내 지원 기업으로 기업 분석 받기/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "내 지원서" })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("still gates a real report id behind login", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    window.history.replaceState({}, "", "/company-report?analysisId=analysis-1");
    render(<CompanyReport />);
    expect(await screen.findByText("로그인이 필요해요")).toBeTruthy();
  });
});
