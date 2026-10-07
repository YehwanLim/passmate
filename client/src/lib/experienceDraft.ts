import { AuthenticationRequiredError, getAuthorizationHeader } from "@/lib/apiAuth";

/** 경험 → 초안 API 클라이언트. 서버 lib/experience-draft.js 의 응답 필드명과 함께 움직인다. */
export type DraftSentence = { text: string; kind: "job" | "experience" | "plan"; sourceIds: string[]; unsourced: boolean };
export type DraftOk = {
  kind: "ok";
  chosen: Array<{ experienceId: string; title: string; reason: string }>;
  sentences: DraftSentence[];
  draftText: string;
  charCount: number;
  replacedNumbers: number;
  remainingToday: number;
};
export type DraftResult =
  | DraftOk
  | { kind: "needs_more"; needMore: string; remainingToday: number }
  | { kind: "no_experiences" }
  | { kind: "rate_limited" }
  | { kind: "auth_required" }
  | { kind: "failed" };

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function parseDraftResponse(status: number, body: unknown): DraftResult {
  if (status === 401) return { kind: "auth_required" };
  if (status === 429) return { kind: "rate_limited" };
  if (status === 422 && isObj(body) && body.error === "NO_EXPERIENCES") return { kind: "no_experiences" };
  if (status !== 200 || !isObj(body)) return { kind: "failed" };
  if (body.status === "needs_more") {
    return { kind: "needs_more", needMore: str(body.need_more), remainingToday: num(body.remaining_today) };
  }
  if (body.status !== "ok" || !Array.isArray(body.sentences)) return { kind: "failed" };
  return {
    kind: "ok",
    chosen: (Array.isArray(body.chosen) ? body.chosen : [])
      .filter(isObj)
      .map((c) => ({ experienceId: str(c.experience_id), title: str(c.title), reason: str(c.reason) })),
    sentences: body.sentences.filter(isObj).map((s) => ({
      text: str(s.text),
      kind: s.kind === "job" || s.kind === "plan" ? s.kind : "experience",
      sourceIds: Array.isArray(s.source_ids) ? s.source_ids.filter((id): id is string => typeof id === "string") : [],
      unsourced: s.unsourced === true,
    })),
    draftText: str(body.draft_text),
    charCount: num(body.char_count),
    replacedNumbers: num(body.replaced_numbers),
    remainingToday: num(body.remaining_today),
  };
}

export async function requestExperienceDraft(input: {
  projectId: string;
  prompt: string;
  charLimit: number | null;
  avoidExperienceIds?: string[];
}): Promise<DraftResult> {
  let response: Response;
  try {
    response = await fetch("/api/analyze/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthorizationHeader()) },
      body: JSON.stringify(input),
    });
  } catch (caught) {
    if (caught instanceof AuthenticationRequiredError) return { kind: "auth_required" };
    return { kind: "failed" };
  }
  const body = await response.json().catch(() => null);
  return parseDraftResponse(response.status, body);
}

/** 서버·모델이 남긴 빈칸([실제 수치] 등, 20자 이내)을 강조하려고 떼어 낸다. */
const BLANK = /(\[[^[\]\n]{1,20}\])/g;
const IS_BLANK = /^\[[^[\]\n]{1,20}\]$/;
export function splitBlanks(text: string): Array<{ text: string; blank: boolean }> {
  return text
    .split(BLANK)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, blank: IS_BLANK.test(part) }));
}
