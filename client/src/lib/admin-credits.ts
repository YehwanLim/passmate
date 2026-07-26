import { supabase } from "./supabase";

export interface CreditSummary {
  userId?: string;
  premiumEnabled: boolean;
  freeRemaining: number;
  bonusRemaining: number;
  premiumRemaining: number;
  remaining: number;
}

export interface CreditCoupon {
  id: string;
  code: string;
  creditsGranted: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCreditGrant {
  id: string;
  userId: string;
  grantedByUserId: string;
  creditsGranted: number;
  source: "MANUAL" | "COUPON";
  couponId: string | null;
  note: string | null;
  createdAt: string;
}

export interface UserCreditDetail {
  summary: CreditSummary;
  grants: AdminCreditGrant[];
}

export interface GrantUserCreditsInput {
  userId: string;
  credits: number;
  note?: string;
}

export interface ApplyCouponToUserInput {
  userId: string;
  couponId: string;
}

export interface CreateCreditCouponInput {
  code: string;
  creditsGranted: number;
  maxUses?: number | null;
  expiresAt?: string | null;
}

export interface UpdateCreditCouponInput {
  id: string;
  creditsGranted?: number;
  isActive?: boolean;
  maxUses?: number | null;
  expiresAt?: string | null;
}

type JsonRecord = Record<string, unknown>;

function value(record: JsonRecord, camelCase: string, snakeCase: string) {
  return Object.hasOwn(record, snakeCase) ? record[snakeCase] : record[camelCase];
}

function mapCreditSummary(summary: JsonRecord): CreditSummary {
  const userId = value(summary, "userId", "user_id");

  return {
    ...(typeof userId === "string" ? { userId } : {}),
    premiumEnabled: Boolean(value(summary, "premiumEnabled", "premium_enabled")),
    freeRemaining: Number(value(summary, "freeRemaining", "free_remaining")),
    bonusRemaining: Number(value(summary, "bonusRemaining", "bonus_remaining")),
    premiumRemaining: Number(value(summary, "premiumRemaining", "premium_remaining")),
    remaining: Number(summary.remaining),
  };
}

function mapCreditCoupon(coupon: JsonRecord): CreditCoupon {
  return {
    id: String(coupon.id),
    code: String(coupon.code),
    creditsGranted: Number(value(coupon, "creditsGranted", "credits_granted")),
    maxUses: value(coupon, "maxUses", "max_uses") as number | null,
    usedCount: Number(value(coupon, "usedCount", "used_count")),
    expiresAt: value(coupon, "expiresAt", "expires_at") as string | null,
    isActive: Boolean(value(coupon, "isActive", "is_active")),
    createdAt: String(value(coupon, "createdAt", "created_at")),
    updatedAt: String(value(coupon, "updatedAt", "updated_at")),
  };
}

function mapAdminCreditGrant(grant: JsonRecord): AdminCreditGrant {
  return {
    id: String(grant.id),
    userId: String(value(grant, "userId", "user_id")),
    grantedByUserId: String(value(grant, "grantedByUserId", "granted_by_user_id")),
    creditsGranted: Number(value(grant, "creditsGranted", "credits_granted")),
    source: String(grant.source) as AdminCreditGrant["source"],
    couponId: value(grant, "couponId", "coupon_id") as string | null,
    note: grant.note as string | null,
    createdAt: String(value(grant, "createdAt", "created_at")),
  };
}

export async function adminCreditsRequest<T>(
  path: string,
  init: RequestInit = {},
  fallback = "관리자 이용권 요청을 처리하지 못했습니다.",
): Promise<T> {
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
    ? await response.json() as JsonRecord
    : null;

  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : fallback;
    throw new Error(message);
  }
  if (!payload) {
    throw new Error(fallback);
  }

  return payload as T;
}

export async function fetchUserCreditSummaries(userIds: string[]): Promise<CreditSummary[]> {
  const params = new URLSearchParams({ userIds: userIds.join(",") });
  const payload = await adminCreditsRequest<{ summaries: JsonRecord[] }>(
    `/api/admin/user-credits?${params.toString()}`,
    {},
    "사용자 이용권 정보를 불러오지 못했습니다.",
  );
  return payload.summaries.map(mapCreditSummary);
}

export async function fetchUserCreditDetail(userId: string): Promise<UserCreditDetail> {
  const params = new URLSearchParams({ userId });
  const payload = await adminCreditsRequest<{ summary: JsonRecord; grants: JsonRecord[] }>(
    `/api/admin/user-credits?${params.toString()}`,
    {},
    "사용자 이용권 상세 정보를 불러오지 못했습니다.",
  );
  return { summary: mapCreditSummary(payload.summary), grants: payload.grants.map(mapAdminCreditGrant) };
}

export async function grantUserCredits(input: GrantUserCreditsInput): Promise<CreditSummary> {
  const payload = await adminCreditsRequest<{ summary: JsonRecord }>(
    "/api/admin/user-credits",
    { method: "POST", body: JSON.stringify({ action: "grant", ...input }) },
    "이용권을 지급하지 못했습니다.",
  );
  return mapCreditSummary(payload.summary);
}

export async function applyCouponToUser(input: ApplyCouponToUserInput): Promise<CreditSummary> {
  const payload = await adminCreditsRequest<{ summary: JsonRecord }>(
    "/api/admin/user-credits",
    { method: "POST", body: JSON.stringify({ action: "applyCoupon", ...input }) },
    "쿠폰을 적용하지 못했습니다.",
  );
  return mapCreditSummary(payload.summary);
}

export async function fetchCreditCoupons(): Promise<CreditCoupon[]> {
  const payload = await adminCreditsRequest<{ coupons: JsonRecord[] }>(
    "/api/admin/credit-coupons",
    {},
    "이용권 쿠폰을 불러오지 못했습니다.",
  );
  return payload.coupons.map(mapCreditCoupon);
}

export async function createCreditCoupon(input: CreateCreditCouponInput): Promise<CreditCoupon> {
  const payload = await adminCreditsRequest<{ coupon: JsonRecord }>(
    "/api/admin/credit-coupons",
    { method: "POST", body: JSON.stringify(input) },
    "이용권 쿠폰을 만들지 못했습니다.",
  );
  return mapCreditCoupon(payload.coupon);
}

export async function updateCreditCoupon(input: UpdateCreditCouponInput): Promise<CreditCoupon> {
  const payload = await adminCreditsRequest<{ coupon: JsonRecord }>(
    "/api/admin/credit-coupons",
    { method: "PATCH", body: JSON.stringify(input) },
    "이용권 쿠폰을 수정하지 못했습니다.",
  );
  return mapCreditCoupon(payload.coupon);
}
