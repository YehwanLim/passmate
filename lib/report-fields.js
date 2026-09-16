// 저장된 리포트 JSON(analyses.aiResponseJson)에서 목록·상세 응답이 읽는 필드. 세 핸들러가 같은 규칙을 쓴다.

export function parseReport(aiResponseJson) {
  try {
    const data = typeof aiResponseJson === "string" ? JSON.parse(aiResponseJson) : aiResponseJson;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

// 프롬프트는 상단 카드 필드에 강조 표시를 금지하지만 모델이 가끔 `**`로 감싸서 준다(09-15 아티언스).
// 리포트 화면은 renderCleanText 로 벗기고, 목록·상세 카드는 여기서 벗긴다.
export function stripEmphasis(text) {
  return typeof text === "string" ? text.replace(/\*\*/g, "").trim() : text;
}

/** 카드 한 줄 요약. 구버전 summary → 자소서 첫인상 → 기업 리포트 한 줄 순으로 찾는다. */
export function extractSummary(aiResponseJson) {
  const data = parseReport(aiResponseJson);
  if (!data) return null;
  return stripEmphasis(
    data.summary
      ?? data.firstImpression?.summaryOneLiner
      ?? data.firstImpression?.persona
      ?? data.brief?.oneLiner
      ?? null,
  );
}

const MAX_CARD_KEYWORDS = 6;

// 카드 칩용 키워드. 리포트 화면(reportFirstImpression.ts)과 같은 규칙으로 "#"을 떼고 중복을 제거한다.
export function normalizeKeywords(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const keyword = stripEmphasis(item).replace(/^#/, "").trim();
    if (keyword.length === 0) continue;
    seen.add(keyword);
    if (seen.size >= MAX_CARD_KEYWORDS) break;
  }
  return Array.from(seen);
}

// 자소서 리포트는 firstImpression.hashtags, 기업 리포트는 brief.keywords.
export function extractKeywords(aiResponseJson) {
  const data = parseReport(aiResponseJson);
  if (!data) return [];
  return normalizeKeywords(data.firstImpression?.hashtags ?? data.brief?.keywords);
}

/** 사용자에게 내려주는 본문. 점수 필드는 서비스 원칙(점수 없음)대로 뗀다. */
export function sanitizeAiResponse(aiResponseJson) {
  const data = parseReport(aiResponseJson);
  if (!data) return null;
  const { score, ...rest } = data;
  return rest;
}
