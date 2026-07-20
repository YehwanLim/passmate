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
const MENTOR_COMMENT_TITLES = ["읽힌 인상", "더 선명해질 지점", "면접에서 준비할 것"]

export type MentorCommentBlock = {
  title: string
  text: string
}

export type CommentKeywordToken = {
  text: string
  highlighted: boolean
}

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

export function getHeroIdentity(persona: string, hashtags: string[]): string {
  const compressed = compressPersonaForHero(persona)
  if (compressed.length <= 28) return compressed

  const keywords = Array.from(new Set(hashtags.map((hashtag) => hashtag.replace(/^#/, "").trim()).filter(Boolean)))
  const domain = keywords[0]
  const roleKeyword = keywords.find((keyword) => /PM|기획|영업|마케팅|개발|디자인/.test(keyword))
  const role = roleKeyword === "사업기획"
    ? "사업기획자"
    : roleKeyword === "신사업개발"
      ? "사업개발자"
      : roleKeyword
  const action = keywords.some((keyword) => /신사업|기회발굴/.test(keyword))
    ? "기회발굴형"
    : keywords.some((keyword) => /분석|리서치|데이터/.test(keyword))
      ? "분석형"
      : "실행형"

  if (domain && role) return `${domain} ${action} ${role}`
  return limitReportText(compressed, 28)
}

export function getHeroSummary(summary: string, hashtags: string[]): string {
  const normalized = summary.replace(/\s+/g, " ").trim()
  if (normalized.length <= 42) return normalized

  const domain = hashtags.map((hashtag) => hashtag.replace(/^#/, "").trim()).find(Boolean)
  return domain ? `${domain}의 성장 기회를 사업으로 연결하려는 지원자` : limitReportText(normalized, 42)
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

export function limitReportText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized

  const shortened = normalized.slice(0, maxLength - 1)
  const boundary = shortened.lastIndexOf(" ")
  const beforeBoundary = shortened.slice(0, boundary)
  const previousBoundary = beforeBoundary.lastIndexOf(" ")
  const textAtBoundary = boundary > Math.floor(maxLength / 2)
    ? previousBoundary > 0 ? shortened.slice(0, previousBoundary) : beforeBoundary
    : shortened

  return `${textAtBoundary.trimEnd()}…`
}

function splitIntoSentences(comment: string): string[] {
  return comment.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? []
}

function createCommentBlocks(parts: string[]): MentorCommentBlock[] {
  return parts.filter(Boolean).slice(0, MENTOR_COMMENT_TITLES.length).map((text, index) => ({
    title: MENTOR_COMMENT_TITLES[index],
    text,
  }))
}

export function splitMentorComment(comment: string): MentorCommentBlock[] {
  const paragraphs = comment.split(/\n\s*\n+/).map((paragraph) => paragraph.trim()).filter(Boolean)
  if (paragraphs.length >= MENTOR_COMMENT_TITLES.length) {
    return createCommentBlocks([
      paragraphs[0],
      paragraphs[1],
      paragraphs.slice(2).join("\n\n"),
    ])
  }

  const sentences = splitIntoSentences(comment.replace(/\s+/g, " ").trim())
  if (sentences.length <= MENTOR_COMMENT_TITLES.length) return createCommentBlocks(sentences)

  const perBlock = Math.floor(sentences.length / MENTOR_COMMENT_TITLES.length)
  return createCommentBlocks([
    sentences.slice(0, perBlock).join(" "),
    sentences.slice(perBlock, perBlock * 2).join(" "),
    sentences.slice(perBlock * 2).join(" "),
  ])
}

export function tokenizeCommentKeywords(text: string, keywords: string[]): CommentKeywordToken[] {
  const normalizedKeywords = Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)))
    .sort((left, right) => right.length - left.length)
  const selections: Array<{ start: number; end: number }> = []

  for (const keyword of normalizedKeywords) {
    let start = text.indexOf(keyword)
    while (start !== -1) {
      const end = start + keyword.length
      const overlaps = selections.some((selection) => start < selection.end && end > selection.start)
      if (!overlaps) {
        selections.push({ start, end })
        break
      }
      start = text.indexOf(keyword, start + 1)
    }
  }

  const sortedSelections = selections.sort((left, right) => left.start - right.start)
  const tokens: CommentKeywordToken[] = []
  let cursor = 0

  for (const selection of sortedSelections) {
    if (selection.start > cursor) tokens.push({ text: text.slice(cursor, selection.start), highlighted: false })
    tokens.push({ text: text.slice(selection.start, selection.end), highlighted: true })
    cursor = selection.end
  }

  if (cursor < text.length) tokens.push({ text: text.slice(cursor), highlighted: false })
  return tokens
}
