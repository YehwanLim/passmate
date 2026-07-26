import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_EMAIL = "original-admin@example.com";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const MISSING_USER_ID = "44444444-4444-4444-8444-444444444444";
const COUPON_ID = "33333333-3333-4333-8333-333333333333";
const SUMMARY = { freeRemaining: 1, bonusRemaining: 2, premiumRemaining: 0, premiumEnabled: false, remaining: 3 };

const mocks = vi.hoisted(() => ({
  applyCreditCoupon: vi.fn(),
  getEntitlementSummaries: vi.fn(),
  getEntitlementSummary: vi.fn(),
  prisma: { $transaction: vi.fn(), adminCreditGrant: { findMany: vi.fn() }, user: { findMany: vi.fn(), findUnique: vi.fn() } },
  grantAdminCredits: vi.fn(),
  requireAdministrator: vi.fn(),
  transaction: {},
}));

vi.mock("../../../lib/admin-auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/analysis-entitlements.js", () => ({
  applyCreditCoupon: mocks.applyCreditCoupon,
  getEntitlementSummaries: mocks.getEntitlementSummaries,
  getEntitlementSummary: mocks.getEntitlementSummary,
  grantAdminCredits: mocks.grantAdminCredits,
}));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { default: handler } = await import("../../../api/admin/user-credits.js");

function createResponse() {
  return { body: undefined, statusCode: 200, json(payload) { this.body = payload; return this; }, status(statusCode) { this.statusCode = statusCode; return this; } };
}

async function invokeUserCredits({ body, method = "GET", query, url = "/api/admin/user-credits" } = {}) {
  const response = createResponse();
  await handler({ body, headers: {}, method, query, url }, response);
  return response;
}

describe("admin user credit API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({ id: ADMIN_ID, email: ADMIN_EMAIL });
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.transaction));
    mocks.prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
    mocks.prisma.user.findMany.mockResolvedValue([{ id: USER_ID }]);
    mocks.getEntitlementSummaries.mockResolvedValue([{ userId: USER_ID, ...SUMMARY }]);
    mocks.getEntitlementSummary.mockResolvedValue(SUMMARY);
    mocks.grantAdminCredits.mockResolvedValue(SUMMARY);
    mocks.applyCreditCoupon.mockResolvedValue(SUMMARY);
    mocks.prisma.adminCreditGrant.findMany.mockResolvedValue([]);
  });

  it("rejects a request before any credit query when no administrator is verified", async () => {
    mocks.requireAdministrator.mockImplementation(async (_req, res) => {
      res.status(403).json({ error: "Forbidden" });
      return null;
    });
    const response = await invokeUserCredits({ query: { userIds: USER_ID } });
    expect(response.statusCode).toBe(403);
    expect(mocks.getEntitlementSummaries).not.toHaveBeenCalled();
  });

  it("rejects a malformed manual grant before a credit write", async () => {
    const response = await invokeUserCredits({ method: "POST", body: { action: "grant", userId: USER_ID, credits: 0 } });
    expect(response).toMatchObject({ statusCode: 400, body: { error: expect.any(String) } });
    expect(mocks.grantAdminCredits).not.toHaveBeenCalled();
  });

  it("writes a manual grant for the verified administrator only", async () => {
    const response = await invokeUserCredits({ method: "POST", body: { action: "grant", userId: USER_ID, credits: 2, note: "  CS  " } });
    expect(response).toMatchObject({ statusCode: 200, body: { summary: SUMMARY } });
    expect(mocks.grantAdminCredits).toHaveBeenCalledWith(mocks.transaction, {
      userId: USER_ID,
      credits: 2,
      note: "CS",
      grantedByUserId: ADMIN_ID,
      grantedByEmail: ADMIN_EMAIL,
    });
  });

  it("snapshots the verified administrator email for a coupon grant", async () => {
    const response = await invokeUserCredits({
      method: "POST",
      body: { action: "applyCoupon", userId: USER_ID, couponId: COUPON_ID },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.applyCreditCoupon).toHaveBeenCalledWith(mocks.transaction, {
      userId: USER_ID,
      couponId: COUPON_ID,
      grantedByUserId: ADMIN_ID,
      grantedByEmail: ADMIN_EMAIL,
    });
  });

  it("returns 409 when a coupon cannot be applied", async () => {
    mocks.applyCreditCoupon.mockRejectedValue(Object.assign(new Error("used"), { code: "COUPON_ALREADY_APPLIED" }));
    const response = await invokeUserCredits({ method: "POST", body: { action: "applyCoupon", userId: USER_ID, couponId: COUPON_ID } });
    expect(response).toMatchObject({ statusCode: 409, body: { error: "COUPON_ALREADY_APPLIED" } });
  });

  it("returns a bulk summary only when userIds is the sole query selector", async () => {
    const response = await invokeUserCredits({ url: `/api/admin/user-credits?userIds=${USER_ID}` });
    expect(response).toMatchObject({ statusCode: 200, body: { summaries: [{ userId: USER_ID, ...SUMMARY }] } });
    expect(mocks.getEntitlementSummaries).toHaveBeenCalledWith(mocks.transaction, [USER_ID]);
  });

  it("returns 404 instead of synthesizing a summary when a bulk recipient is missing", async () => {
    const response = await invokeUserCredits({ url: `/api/admin/user-credits?userIds=${USER_ID},${MISSING_USER_ID}` });
    expect(response).toMatchObject({ statusCode: 404, body: { error: "User Not Found" } });
    expect(mocks.getEntitlementSummaries).not.toHaveBeenCalled();
  });
});
