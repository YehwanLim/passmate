import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";

/** 경험 카드 추천 키워드 API 클라이언트. 서버 lib/experience-keywords.js 의 응답 필드명과 함께 움직인다. */
export const KEYWORD_TEXT_MIN = 20;

export type KeywordResult =
  | { kind: "ok"; keywords: string[]; remainingToday: number }
  | { kind: "empty"; remainingToday: number }
  | { kind: "rate_limited" }
  | { kind: "invalid" }
  | { kind: "auth_required" }
  | { kind: "network" }
  | { kind: "failed" };

export function parseKeywordResponse(status: number, body: unknown): KeywordResult {
  if (status === 401) return { kind: "auth_required" };
  if (status === 429) return { kind: "rate_limited" };
  if (status === 400) return { kind: "invalid" };
  if (status !== 200 || typeof body !== "object" || body === null || !Array.isArray((body as { keywords?: unknown }).keywords)) {
    return { kind: "failed" };
  }
  const raw = body as { keywords: unknown[]; remaining_today?: unknown };
  const remainingToday = typeof raw.remaining_today === "number" && Number.isFinite(raw.remaining_today) ? raw.remaining_today : 0;
  const keywords = raw.keywords.filter((k): k is string => typeof k === "string" && k.trim().length > 0);
  return keywords.length > 0 ? { kind: "ok", keywords, remainingToday } : { kind: "empty", remainingToday };
}

export async function requestKeywordSuggestions(input: { title: string; text: string; tags: string[] }): Promise<KeywordResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthorizationHeader()) },
      body: JSON.stringify(input),
    });
  } catch (caught) {
    if (caught instanceof AuthenticationRequiredError) return { kind: "auth_required" };
    return { kind: "network" };
  }
  const body = await response.json().catch(() => null);
  return parseKeywordResponse(response.status, body);
}
