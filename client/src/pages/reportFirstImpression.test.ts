import { describe, expect, it } from "vitest"
import {
  buildEditorialKeywords,
  buildHiringMemoryItems,
  compressPersonaForHero,
  getHeroIdentity,
  getHeroSummary,
  limitReportText,
  splitPersonaForHeroLines,
  splitMentorComment,
  tokenizeCommentKeywords,
} from "./reportFirstImpression"

describe("report first impression editorial helpers", () => {
  it("compresses long persona copy into a hero-sized identity", () => {
    expect(compressPersonaForHero("데이터를 통해 인사이트를 도출하고 실행에 옮기는 PM")).toBe("데이터 기반 실행형 PM")
  })

  it("keeps concise persona copy unchanged", () => {
    expect(compressPersonaForHero("문제 해결형 기획자")).toBe("문제 해결형 기획자")
  })

  it("turns a legacy persona into a domain-action-role identity", () => {
    expect(getHeroIdentity(
      "KOTRA 인턴 경험에서 식량 수출입에 대한 흥미를 발견하고, AI 스타트업에서의 신사업 발굴 경험으로 거시적 분석력을 키운 지원자",
      ["#식량사업", "#시장분석", "#사업기획"],
    )).toBe("식량사업 분석형 사업기획자")
  })

  it("replaces a truncated legacy summary with a complete domain narrative", () => {
    expect(getHeroSummary(
      "국제 경험과 비즈니스 통찰력을 바탕으로 식량 산업 변화를 분석하고 새로운 사업 기회로 연결하려는 지원자입니다.",
      ["#식량산업", "#신사업개발"],
    )).toBe("식량산업의 성장 기회를 사업으로 연결하려는 지원자")
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

  it("limits legacy summary copy without breaking a word", () => {
    expect(limitReportText("시장 데이터를 사업 기회로 연결하고 실행까지 이끄는 기획형 지원자입니다", 28))
      .toBe("시장 데이터를 사업 기회로 연결하고…")
  })

  it("keeps the first complete word when no earlier boundary exists", () => {
    expect(limitReportText("매우긴단어입니다 식량 산업을 분석합니다", 12)).toBe("매우긴단어입니다…")
  })

  it("splits paragraph and legacy comments into three editorial blocks", () => {
    expect(splitMentorComment("첫 인상입니다.\n\n보완점입니다.\n\n면접 준비입니다.").map((item) => item.title))
      .toEqual(["읽힌 인상", "더 선명해질 지점", "면접에서 준비할 것"])
    expect(splitMentorComment("첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다.")).toHaveLength(3)
  })

  it("keeps long legacy comments complete while distributing sentences into editorial blocks", () => {
    const comment = "첫 문장입니다. 둘째 문장입니다. 셋째 문장입니다. 넷째 문장입니다."
    const blocks = splitMentorComment(comment)

    expect(blocks.map((block) => block.text).join(" ")).toBe(comment)
    expect(blocks.map((block) => block.title)).toEqual(["읽힌 인상", "더 선명해질 지점", "면접에서 준비할 것"])
  })

  it("marks only matching editorial keywords for inline emphasis", () => {
    expect(tokenizeCommentKeywords("식량사업의 시장분석 경험이 보입니다.", ["식량사업", "시장분석"])
      .filter((token) => token.highlighted)
      .map((token) => token.text)).toEqual(["식량사업", "시장분석"])
  })

  it("highlights each supplied keyword once and preserves the original text", () => {
    const text = "식량사업을 분석하고 식량사업의 가능성을 확인했습니다."
    const tokens = tokenizeCommentKeywords(text, ["식량사업", "", "식량사업"])

    expect(tokens.map((token) => token.text).join("")).toBe(text)
    expect(tokens.filter((token) => token.highlighted).map((token) => token.text)).toEqual(["식량사업"])
  })
})
