import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "22222222-2222-4222-8222-222222222222";
const COUPON_ID = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

import {
  fetchCreditCoupons,
  fetchUserCreditDetail,
  fetchUserCreditSummaries,
  grantUserCredits,
} from "./admin-credits";

const mockedFetch = () => vi.mocked(global.fetch);

const SUMMARY = {
  free_remaining: 1,
  bonus_remaining: 2,
  premium_remaining: 0,
  premium_enabled: false,
  remaining: 3,
};

function jsonResponse(payload: unknown, { ok = true, status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: ok ? status : status || 400,
  });
}

describe("admin credit API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });
  });

  it("posts a direct grant with the active Supabase bearer token", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ summary: SUMMARY }));

    await grantUserCredits({ userId: USER_ID, credits: 2, note: "support" });

    expect(mockedFetch()).toHaveBeenCalledWith("/api/admin/user-credits", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer session-token", "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "grant", userId: USER_ID, credits: 2, note: "support" }),
    }));
  });

  it("maps server summary and coupon fields to browser camel case", async () => {
    mockedFetch()
      .mockResolvedValueOnce(jsonResponse({ summaries: [{ user_id: USER_ID, ...SUMMARY }] }))
      .mockResolvedValueOnce(jsonResponse({
        coupons: [{
          id: COUPON_ID,
          code: "WELCOME_2",
          credits_granted: 2,
          max_uses: null,
          used_count: 0,
          expires_at: null,
          is_active: true,
          created_at: "2026-07-26T00:00:00.000Z",
          updated_at: "2026-07-26T00:00:00.000Z",
        }],
      }));

    await expect(fetchUserCreditSummaries([USER_ID])).resolves.toEqual([{
      userId: USER_ID,
      freeRemaining: 1,
      bonusRemaining: 2,
      premiumRemaining: 0,
      premiumEnabled: false,
      remaining: 3,
    }]);
    await expect(fetchCreditCoupons()).resolves.toEqual([expect.objectContaining({
      creditsGranted: 2,
      maxUses: null,
      usedCount: 0,
      expiresAt: null,
      isActive: true,
      createdAt: "2026-07-26T00:00:00.000Z",
      updatedAt: "2026-07-26T00:00:00.000Z",
    })]);
  });

  it("maps the immutable grantor email snapshot in credit history", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({
      summary: SUMMARY,
      grants: [{
        id: "grant-id",
        user_id: USER_ID,
        granted_by_user_id: "11111111-1111-4111-8111-111111111111",
        granted_by_email: "original-admin@example.com",
        credits_granted: 2,
        source: "MANUAL",
        coupon_id: null,
        note: "support",
        created_at: "2026-07-26T00:00:00.000Z",
      }],
    }));

    await expect(fetchUserCreditDetail(USER_ID)).resolves.toMatchObject({
      grants: [{ grantedByEmail: "original-admin@example.com" }],
    });
  });

  it("rejects a missing Supabase session before making the request", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await expect(fetchUserCreditDetail(USER_ID)).rejects.toThrow(
      "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.",
    );
    expect(mockedFetch()).not.toHaveBeenCalled();
  });

  it("surfaces JSON API errors", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ error: "COUPON_ALREADY_APPLIED" }, { ok: false, status: 409 }));

    await expect(fetchUserCreditDetail(USER_ID)).rejects.toThrow("COUPON_ALREADY_APPLIED");
  });
});
