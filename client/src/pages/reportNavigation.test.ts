import { describe, expect, it } from "vitest"
import { REPORT_NAV_SECTIONS, buildReportNavSections } from "./reportNavigation"

describe("REPORT_NAV_SECTIONS", () => {
  it("defines numbered report sections in reading order", () => {
    expect(REPORT_NAV_SECTIONS.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 요약",
      "02. 문장별 코멘트",
      "03. 예상 질문",
      "04. 합격 기준",
      "05. 다음 단계",
      "06. 실무자 코멘트",
    ])
  })

  it("keeps every section linked to an in-page anchor", () => {
    expect(REPORT_NAV_SECTIONS.every((section) => section.id.startsWith("section-"))).toBe(true)
  })
})

describe("buildReportNavSections", () => {
  it("matches the default list when the report has no posting fit", () => {
    expect(buildReportNavSections({ hasPostingFit: false })).toEqual(REPORT_NAV_SECTIONS)
  })

  it("inserts 공고 적합도 after 예상 질문 and renumbers the rest", () => {
    const sections = buildReportNavSections({ hasPostingFit: true })
    expect(sections).toHaveLength(7)
    expect(sections.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 요약",
      "02. 문장별 코멘트",
      "03. 예상 질문",
      "04. 공고 적합도",
      "05. 합격 기준",
      "06. 다음 단계",
      "07. 실무자 코멘트",
    ])
    expect(sections[3].id).toBe("section-posting-fit")
  })
})
