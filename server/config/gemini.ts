// =============================================================================
// Gemini API 중앙 설정
// =============================================================================
// 모델명이나 API 버전을 변경할 때 이 파일만 수정하면 됩니다.
// 여러 파일에 하드코딩하여 모델 변경 시 누락이 발생하는 문제를 방지합니다.
// =============================================================================

/** 사용할 Gemini 모델명 */
export const GEMINI_MODEL = "gemini-2.5-flash-lite";

/** Gemini API 버전 */
export const GEMINI_API_VERSION = "v1beta";

/**
 * generateContent 엔드포인트 URL을 생성합니다.
 * @param apiKey - Gemini API Key
 * @returns 완전한 API URL
 */
export function getGeminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
}
