import { supabase } from "./supabase";

export type AdminCreditKind = "RESUME" | "COMPANY";

export interface UserCreditSummary {
  premiumEnabled: boolean;
  freeRemaining: number;
  bonusRemaining: number;
  premiumRemaining: number;
  remaining: number;
  /** 기업 분석 크레딧 잔여. 구버전 응답에 없으면 0. */
  companyRemaining: number;
}

export interface AdminCreditGrantRecord {
  id: string;
  credits_granted: number;
  granted_by_email: string;
  source: string;
  note: string | null;
  created_at: string;
  kind: AdminCreditKind;
}

export interface UserCreditsResponse {
  summary: UserCreditSummary;
  grants: AdminCreditGrantRecord[];
}

type JsonRecord = Record<string, unknown>;

function parseSummary(payload: unknown): UserCreditSummary | null {
  if (!payload || typeof payload !== "object") return null;
  const summary = payload as JsonRecord;
  if (
    typeof summary.premiumEnabled !== "boolean"
    || typeof summary.freeRemaining !== "number"
    || typeof summary.bonusRemaining !== "number"
    || typeof summary.premiumRemaining !== "number"
    || typeof summary.remaining !== "number"
  ) {
    return null;
  }
  return {
    premiumEnabled: summary.premiumEnabled,
    freeRemaining: summary.freeRemaining,
    bonusRemaining: summary.bonusRemaining,
    premiumRemaining: summary.premiumRemaining,
    remaining: summary.remaining,
    companyRemaining:
      typeof summary.companyRemaining === "number" && Number.isInteger(summary.companyRemaining) && summary.companyRemaining >= 0
        ? summary.companyRemaining
        : 0,
  };
}

function parseGrant(value: JsonRecord): AdminCreditGrantRecord {
  return {
    id: value.id as string,
    credits_granted: value.credits_granted as number,
    granted_by_email: value.granted_by_email as string,
    source: value.source as string,
    note: (value.note as string | null) ?? null,
    created_at: value.created_at as string,
    kind: value.kind === "COMPANY" ? "COMPANY" : "RESUME",
  };
}

async function requestCredits(
  path: string,
  init: RequestInit,
  fallback: string,
): Promise<JsonRecord> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error("관리자 세션이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as JsonRecord)
    : null;

  if (!response.ok) {
    throw new Error(
      payload && typeof payload.error === "string" ? payload.error : fallback,
    );
  }
  if (!payload) throw new Error(fallback);
  return payload;
}

export async function fetchUserCredits(userId: string): Promise<UserCreditsResponse> {
  const fallback = "크레딧 정보를 불러오지 못했습니다.";
  const payload = await requestCredits(
    `/api/admin/credits?userId=${encodeURIComponent(userId)}`,
    {},
    fallback,
  );
  const summary = parseSummary(payload.summary);
  if (!summary || !Array.isArray(payload.grants)) throw new Error(fallback);
  return {
    summary,
    grants: (payload.grants as JsonRecord[]).map(parseGrant),
  };
}

export async function grantUserCredits(input: {
  userId: string;
  credits: number;
  note?: string;
  kind?: AdminCreditKind;
}): Promise<UserCreditSummary> {
  const fallback = "크레딧 지급에 실패했습니다.";
  const payload = await requestCredits(
    "/api/admin/credits",
    {
      method: "POST",
      body: JSON.stringify({
        userId: input.userId,
        credits: input.credits,
        note: input.note?.trim() ? input.note.trim() : undefined,
        kind: input.kind,
      }),
    },
    fallback,
  );
  const summary = parseSummary(payload.summary);
  if (!summary) throw new Error(fallback);
  return summary;
}
