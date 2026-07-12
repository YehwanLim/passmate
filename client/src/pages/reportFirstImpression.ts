type KeywordInput = {
  hashtags: string[]
  talentKeywords: string[]
}

type MemoryInput = {
  strengths: string[]
  gaps: string[]
}

export type HiringMemoryItem = {
  mark: "✓" | "△"
  text: string
}

const MIN_KEYWORDS = 4
const MAX_KEYWORDS = 6

export function compressPersonaForHero(persona: string): string {
  const trimmed = persona.trim()
  if (trimmed.length <= 14) return trimmed

  if (trimmed.includes("데이터") && trimmed.includes("실행") && /PM|기획/.test(trimmed)) {
    return trimmed.includes("PM") ? "데이터 기반 실행형 PM" : "데이터 기반 실행형 기획자"
  }

  if (trimmed.includes("문제") && trimmed.includes("해결") && trimmed.includes("기획")) {
    return "문제 해결형 기획자"
  }

  return trimmed
    .replace(/를 통해/g, " 기반")
    .replace(/인사이트를 도출하고/g, "")
    .replace(/실행에 옮기는/g, "실행형")
    .replace(/\s+/g, " ")
    .trim()
}

export function splitPersonaForHeroLines(persona: string): string[] {
  const words = persona.trim().split(/\s+/).filter(Boolean)
  if (words.length <= 2) return [persona.trim()]

  const midpoint = Math.ceil(words.length / 2)
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")]
}

export function buildEditorialKeywords({ hashtags, talentKeywords }: KeywordInput): string[] {
  const normalized = [...hashtags, ...talentKeywords]
    .map((keyword) => keyword.replace(/^#/, "").replace("의사결정", "").trim())
    .filter(Boolean)
    .filter((keyword) => keyword.length <= 8)

  const unique = Array.from(new Set(normalized))
  const selected = unique.reduce<string[]>((acc, keyword) => {
    if (acc.length >= MAX_KEYWORDS) return acc
    const isDataDuplicate = keyword.includes("데이터") && acc.some((item) => item.includes("데이터"))
    if (isDataDuplicate) return acc
    return [...acc, keyword]
  }, [])

  if (selected.length >= MIN_KEYWORDS) return selected

  return Array.from(new Set([...selected, "문제 해결", "고객 중심", "실행력", "협업"])).slice(0, MAX_KEYWORDS)
}

export function buildHiringMemoryItems({ strengths, gaps }: MemoryInput): HiringMemoryItem[] {
  const joinedStrengths = strengths.join(" ")
  const joinedGaps = gaps.join(" ")

  const positiveItems: HiringMemoryItem[] = [
    { mark: "✓", text: joinedStrengths.includes("논리") ? "논리적으로 일할 것 같다" : "논리적으로 일할 것 같다" },
    { mark: "✓", text: /고객|유저|사용자/.test(joinedStrengths) ? "고객 관점이 강하다" : "고객 관점이 강하다" },
    { mark: "✓", text: /실행|개선|성과/.test(joinedStrengths) ? "실행력이 좋아 보인다" : "실행력이 좋아 보인다" },
  ]

  const cautionText = /산업|도메인|비즈니스|회사/.test(joinedGaps)
    ? "산업 전문성이 더 드러나면 좋겠다"
    : "지원 직무와의 연결이 더 선명하면 좋겠다"

  return [...positiveItems, { mark: "△", text: cautionText }]
}
