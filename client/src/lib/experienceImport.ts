import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";

/** 경험 자동 채우기 API 클라이언트. 서버 lib/experience-extract.js 의 응답 필드명과 함께 움직인다. */
export const EXTRACT_TEXT_MIN = 200;
export const EXTRACT_TEXT_MAX = 20000;
export const EXPERIENCE_PER_USER = 100;

export type ExperienceCandidate = {
  title: string;
  period: string;
  situation: string;
  action: string;
  result: string;
  tags: string[];
  quotes: string[];
};

export type ExtractResult =
  | { kind: "ok"; candidates: ExperienceCandidate[]; remainingToday: number }
  | { kind: "empty"; remainingToday: number }
  | { kind: "rate_limited" }
  | { kind: "limit_reached" }
  | { kind: "invalid" }
  | { kind: "auth_required" }
  | { kind: "network" }
  | { kind: "failed" };

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function parseExtractResponse(status: number, body: unknown): ExtractResult {
  if (status === 401) return { kind: "auth_required" };
  if (status === 429) return { kind: "rate_limited" };
  if (status === 409) return { kind: "limit_reached" };
  if (status === 400) return { kind: "invalid" };
  if (status !== 200 || !isObj(body) || !Array.isArray(body.candidates)) return { kind: "failed" };
  const remainingToday = num(body.remaining_today);
  const candidates = body.candidates.filter(isObj).map((c) => ({
    title: str(c.title),
    period: str(c.period),
    situation: str(c.situation),
    action: str(c.action),
    result: str(c.result),
    tags: strs(c.tags),
    quotes: strs(c.quotes),
  }));
  return candidates.length > 0 ? { kind: "ok", candidates, remainingToday } : { kind: "empty", remainingToday };
}

export async function requestExperienceCandidates(text: string): Promise<ExtractResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthorizationHeader()) },
      body: JSON.stringify({ text }),
    });
  } catch (caught) {
    if (caught instanceof AuthenticationRequiredError) return { kind: "auth_required" };
    return { kind: "network" };
  }
  const body = await response.json().catch(() => null);
  return parseExtractResponse(response.status, body);
}

// 공백·문장부호·기호를 빼고 한글·영문·숫자만 비교한다.
const titleKey = (value: string) => value.toLowerCase().replace(/[^0-9a-z가-힣]/g, "");

/** 금고에 이미 비슷한 경험이 있는지: 공백·문장부호를 빼고 같거나 한쪽이 다른 쪽을 품으면 비슷하다. */
export function isSimilarTitle(a: string, b: string): boolean {
  const x = titleKey(a);
  const y = titleKey(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** 서버 한도(태그 5개·태그당 20자)에 맞춰 보내야 400을 받지 않는다. */
export function parseTags(raw: string): string[] {
  const tags = raw.split(",").map((t) => t.trim().slice(0, 20)).filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 5);
}
