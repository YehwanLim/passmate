import { describe, expect, it } from "vitest";

import { COMPANY_HERO_ID, COMPANY_REPORT_NAV_SECTIONS } from "./companyReportNavigation";

describe("company report navigation", () => {
  it("lists the eight sections and the appendix in reading order", () => {
    expect(COMPANY_REPORT_NAV_SECTIONS.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 돈 버는 구조",
      "02. 밀고 있는 사업",
      "03. 숫자로 보는 회사",
      "04. 최근 1년의 국면",
      "05. 이 직무의 자리",
      "06. 기회와 리스크",
      "07. 맡고 싶은 사업",
      "08. 면접 전 체크리스트",
      "09. 출처와 기준일",
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
