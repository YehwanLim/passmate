import { describe, expect, it } from "vitest";

import { COMPANY_HERO_ID, COMPANY_REPORT_NAV_SECTIONS } from "./companyReportNavigation";

describe("company report navigation", () => {
  it("lists the eight sections and the appendix in reading order", () => {
    expect(COMPANY_REPORT_NAV_SECTIONS.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 사업 구조",
      "02. 집중 사업",
      "03. 실적과 주가",
      "04. 최근 이슈",
      "05. 직무의 역할",
      "06. 기회와 위험",
      "07. 자소서 소재",
      "08. 면접 준비",
      "09. 출처",
    ]);
  });

  it("uses company- prefixed ids that never collide with the résumé report", () => {
    expect(COMPANY_HERO_ID).toBe("company-hero");
    for (const section of COMPANY_REPORT_NAV_SECTIONS) {
      expect(section.id.startsWith("company-")).toBe(true);
      expect(section.id.startsWith("section-")).toBe(false);
    }
    expect(new Set(COMPANY_REPORT_NAV_SECTIONS.map((section) => section.id)).size).toBe(9);
  });
});
