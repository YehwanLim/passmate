import { describe, expect, it } from "vitest"
import { REPORT_NAV_SECTIONS, buildReportNavSections } from "./reportNavigation"

describe("REPORT_NAV_SECTIONS", () => {
  it("defines numbered report sections in reading order", () => {
    expect(REPORT_NAV_SECTIONS.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 첫인상",
      "02. 합격 기준",
      "03. 핵심 진단",
      "04. 문장 분석",
      "05. 예상 질문",
      "06. 다음 단계",
      "07. 실무자 코멘트",
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

  it("inserts 공고 적합도 after 합격 기준 and renumbers the rest", () => {
    const sections = buildReportNavSections({ hasPostingFit: true })
    expect(sections).toHaveLength(8)
    expect(sections.map((section) => `${section.indexLabel}. ${section.label}`)).toEqual([
      "01. 첫인상",
      "02. 합격 기준",
      "03. 공고 적합도",
      "04. 핵심 진단",
      "05. 문장 분석",
      "06. 예상 질문",
      "07. 다음 단계",
      "08. 실무자 코멘트",
    ])
    expect(sections[2].id).toBe("section-posting-fit")
  })
})
