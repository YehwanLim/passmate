import type { PostingFit } from "@/types/report";

/**
 * 공고 적합도 섹션을 그릴 수 있는 postingFit 인지 본다.
 * 공고 없는 리포트·구버전 리포트에는 필드가 없고, 모델이 요구사항 대조를 비워 내면 섹션 자체를 숨긴다.
 */
export function isPostingFitRenderable(value: unknown): value is PostingFit {
  if (!value || typeof value !== "object") return false;
  const fit = value as Record<string, unknown>;
  return typeof fit.headline === "string" && Array.isArray(fit.requirementMatches) && fit.requirementMatches.length > 0;
}
