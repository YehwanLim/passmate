// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { COMPANY_REPORT_SAMPLE } from "@/constants/companyReportSample";
import { COMPANY_REPORT_NAV_SECTIONS } from "@/pages/companyReportNavigation";

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));

import CompanyReportIntroSection, {
  COMPANY_REPORT_INTRO_ID,
} from "./CompanyReportIntroSection";

// jsdom 환경에서는 import.meta.url 이 file: 이 아니라서 작업 디렉터리 기준으로 읽는다.
const source = readFileSync(
  join(process.cwd(), "client/src/components/CompanyReportIntroSection.tsx"),
  "utf8"
);

class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("CompanyReportIntroSection", () => {
  beforeEach(() => {
    // framer-motion whileInView 가 IntersectionObserver 를 요구한다.
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    mocks.navigate.mockReset();
  });

  it("anchors the section so the top navigation can scroll to it later", () => {
    const { container } = render(<CompanyReportIntroSection />);
    expect(COMPANY_REPORT_INTRO_ID).toBe("company-report-intro");
    expect(
      container.querySelector(`#${COMPANY_REPORT_INTRO_ID}`)
    ).not.toBeNull();
  });

  it("shows the real report table of contents instead of made-up features", () => {
    render(<CompanyReportIntroSection />);
    for (const section of COMPANY_REPORT_NAV_SECTIONS) {
      expect(screen.getByText(section.label)).toBeTruthy();
      expect(screen.getByText(section.indexLabel)).toBeTruthy();
    }
  });

  it("opens the analysis form and the company ticket from its two calls to action", () => {
    render(<CompanyReportIntroSection />);
    fireEvent.click(screen.getByRole("button", { name: "기업 분석 시작하기" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/company-analysis");
    fireEvent.click(screen.getByRole("button", { name: "이용권 보기" }));
    expect(mocks.navigate).toHaveBeenCalledWith("/entitlements#company");
  });

  it("takes the price from lib/pricing and never hard-codes won amounts", () => {
    expect(source).toContain("PRICING.company.salePrice");
    expect(source).not.toMatch(/\d,\d{3}원/);
  });

  it("keeps score, percent, and AI decoration out of the copy", () => {
    expect(source).not.toMatch(/\d+점/);
    expect(source).not.toMatch(/\d+%/);
    expect(source).not.toContain("AI");
  });

  it("opens the public sample report for the sample company", () => {
    render(<CompanyReportIntroSection />);
    screen
      .getByRole("button", { name: new RegExp(`샘플 리포트 보기.*${COMPANY_REPORT_SAMPLE.company}`) })
      .click();
    expect(mocks.navigate).toHaveBeenCalledWith("/company-report?sample=1");
  });
});
