import { describe, expect, it } from "vitest";

import { COMPANY_HERO_ID, COMPANY_REPORT_NAV_SECTIONS, buildCompanyReportNavSections } from "./companyReportNavigation";

describe("company report navigation", () => {
  it("lists the standard sections and the appendix in reading order", () => {
    expect(COMPANY_REPORT_NAV_SECTIONS.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 사업 구조",
      "02. 경쟁사 비교",
      "03. 집중 사업",
      "04. 경영진 메시지",
      "05. 실적과 주가",
      "06. 최근 이슈",
      "07. 직무의 역할",
      "08. 기회와 위험",
      "09. 자소서 소재",
      "10. 면접 준비",
      "11. 출처",
    ]);
  });

  it("inserts the hiring process before the appendix and renumbers when it is present", () => {
    const sections = buildCompanyReportNavSections({ hasCompetitors: true, hasLeadership: true, hasProcess: true });
    expect(sections.slice(-2).map((section) => `${section.indexLabel}. ${section.label}`)).toEqual(["11. 전형 안내", "12. 출처"]);
  });

  it("drops sections an older report never had and keeps the numbering continuous", () => {
    const sections = buildCompanyReportNavSections({ hasCompetitors: false, hasLeadership: false, hasProcess: false });
    expect(sections.map((section) => section.label)).not.toContain("경쟁사 비교");
    expect(sections.map((section) => section.label)).not.toContain("경영진 메시지");
    expect(sections.map((section) => section.indexLabel)).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09"]);
  });

  it("uses company- prefixed ids that never collide with the résumé report", () => {
    expect(COMPANY_HERO_ID).toBe("company-hero");
    const all = buildCompanyReportNavSections({ hasCompetitors: true, hasLeadership: true, hasProcess: true });
    for (const section of all) {
      expect(section.id.startsWith("company-")).toBe(true);
      expect(section.id.startsWith("section-")).toBe(false);
    }
    expect(new Set(all.map((section) => section.id)).size).toBe(12);
  });
});
