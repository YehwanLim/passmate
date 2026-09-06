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

import CompanyReport from "./CompanyReport";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

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
    for (const heading of ["돈 버는 구조", "밀고 있는 사업", "숫자로 보는 회사", "최근 1년의 국면", "이 직무의 자리", "기회와 리스크", "맡고 싶은 사업", "면접 전 체크리스트", "출처와 기준일"]) {
      expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
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

  it("asks unauthenticated visitors to log in", async () => {
    mocks.useAuth.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false });
    render(<CompanyReport />);
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
  });
});
