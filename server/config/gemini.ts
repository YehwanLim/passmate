import fs from "node:fs";
import path from "node:path";

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

function getActiveGeminiModel(): string {
  try {
    const settingsPath = path.join(process.cwd(), "data", "ai-model-settings.json");
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    if (
      settings.defaultModel?.providerKey === "gemini" &&
      typeof settings.defaultModel.modelName === "string"
    ) {
      return settings.defaultModel.modelName;
    }
  } catch {
    // 설정 파일이 없으면 기본 모델 사용
  }
  return GEMINI_MODEL;
}

/**
 * generateContent 엔드포인트 URL을 생성합니다.
 * @param apiKey - Gemini API Key
 * @returns 완전한 API URL
 */
export function getGeminiUrl(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/${GEMINI_API_VERSION}/models/${getActiveGeminiModel()}:generateContent?key=${apiKey}`;
}
