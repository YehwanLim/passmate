// 요청 본문 검증에 쓰는 작은 술어와 입력 정리. api/·lib/ 여러 곳이 같은 규칙을 쓴다.

export function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/** 쿼리 문자열의 양의 정수. 못 읽으면 fallback, 상한은 maximum 으로 자른다. */
export function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

/**
 * 사용자 입력에서 스크립트·태그·인라인 핸들러를 걷어낸다. 자소서 본문과 채용공고 붙여넣기가
 * 프롬프트에 그대로 들어가므로 두 경로가 같은 규칙을 써야 한다.
 */
export function sanitizeInput(value) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|form|input|button|link|meta)\b[^>]*>/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/data\s*:[^,]*,/gi, "")
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "")
    .trim();
}
