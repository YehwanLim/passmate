import { describe, expect, it } from "vitest"
import { REPORT_NAV_SECTIONS } from "./reportNavigation"

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
