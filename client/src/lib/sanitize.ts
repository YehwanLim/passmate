/**
 * XSS 방어를 위한 텍스트 정제 유틸리티
 * 클라이언트 측에서 사용자 입력을 sanitize합니다.
 */

/**
 * HTML 태그, 스크립트, 이벤트 핸들러 등을 제거하여 안전한 텍스트로 변환
 */
export function sanitizeText(input: string): string {
  if (!input) return "";

  let sanitized = input;

  // 1. null bytes 제거
  sanitized = sanitized.replace(/\0/g, "");

  // 2. <script>...</script> 태그 제거 (대소문자 무시)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  // 3. HTML 이벤트 핸들러 속성 제거 (on* 속성)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // 4. <style>...</style> 태그 제거
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // 5. <iframe>, <object>, <embed>, <form> 등 위험 태그 제거
  sanitized = sanitized.replace(/<\/?(?:iframe|object|embed|form|input|button|link|meta)\b[^>]*>/gi, "");

  // 6. javascript: 프로토콜 제거
  sanitized = sanitized.replace(/javascript\s*:/gi, "");

  // 7. data: 프로토콜 제거 (base64 XSS 방지)
  sanitized = sanitized.replace(/data\s*:[^,]*,/gi, "");

  // 8. HTML 엔티티 기반 공격 방지: 나머지 HTML 태그 제거
  sanitized = sanitized.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, "");

  return sanitized.trim();
}
