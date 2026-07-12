import { describe, expect, it } from "vitest"
import {
  buildEditorialKeywords,
  buildHiringMemoryItems,
  compressPersonaForHero,
  splitPersonaForHeroLines,
} from "./reportFirstImpression"

describe("report first impression editorial helpers", () => {
  it("compresses long persona copy into a hero-sized identity", () => {
    expect(compressPersonaForHero("데이터를 통해 인사이트를 도출하고 실행에 옮기는 PM")).toBe("데이터 기반 실행형 PM")
  })

  it("keeps concise persona copy unchanged", () => {
    expect(compressPersonaForHero("문제 해결형 기획자")).toBe("문제 해결형 기획자")
  })

  it("splits compressed persona copy into balanced hero lines", () => {
    expect(splitPersonaForHeroLines("데이터 기반 실행형 PM")).toEqual(["데이터 기반", "실행형 PM"])
    expect(splitPersonaForHeroLines("문제 해결형 기획자")).toEqual(["문제 해결형", "기획자"])
  })

  it("builds four to six deduplicated badge keywords without hashtag marks", () => {
    const keywords = buildEditorialKeywords({
      hashtags: ["#데이터분석", "#가설검증", "#글로벌잠재력", "#데이터분석"],
      talentKeywords: ["고객 중심", "빠른 실행력", "데이터 기반 의사결정", "협업"],
    })

    expect(keywords).toEqual(["데이터분석", "가설검증", "글로벌잠재력", "고객 중심", "빠른 실행력", "협업"])
  })

  it("creates impression-style memory items without numeric scoring language", () => {
    const items = buildHiringMemoryItems({
      strengths: ["고객 데이터를 분석해 문제를 정의하고 개선안을 실행한 경험이 분명합니다."],
      gaps: ["산업 전문성이 조금 더 드러나면 좋겠습니다."],
    })

    expect(items).toEqual([
      { mark: "✓", text: "논리적으로 일할 것 같다" },
      { mark: "✓", text: "고객 관점이 강하다" },
      { mark: "✓", text: "실행력이 좋아 보인다" },
      { mark: "△", text: "산업 전문성이 더 드러나면 좋겠다" },
    ])
    expect(items.map((item) => item.text).join(" ")).not.toMatch(/점수|백분위|랭킹|등급/)
  })
})
