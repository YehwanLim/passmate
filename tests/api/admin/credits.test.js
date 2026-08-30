import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  requireAdministrator: vi.fn(),
  getEntitlementSummary: vi.fn(),
  grantAdminCredits: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

vi.mock("../../../lib/analysis-entitlements.js", () => ({
  getEntitlementSummary: mocks.getEntitlementSummary,
  grantAdminCredits: mocks.grantAdminCredits,
}));

const { default: creditsHandler } = await import("../../../lib/admin-handlers/credits.js");

const ADMIN = {
  applicationUser: {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@preview.dev",
    role: "admin",
  },
};
const USER_ID = "22222222-2222-4222-8222-222222222222";
const SUMMARY = {
  premiumEnabled: false,
  freeRemaining: 0,
  bonusRemaining: 3,
  premiumRemaining: 0,
  remaining: 3,
};

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

async function invoke({ body, method = "GET", query = {} } = {}) {
  const res = response();
  await creditsHandler(
    {
      body,
      headers: { authorization: "Bearer admin-token" },
      method,
      query,
      url: "/api/admin/credits",
    },
    res,
  );
  return res;
}

describe("admin credit grants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue(ADMIN);
    mocks.prisma.user.findUnique.mockResolvedValue({ id: USER_ID });
    mocks.prisma.$transaction.mockImplementation(async (fn) => fn({
      adminCreditGrant: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "33333333-3333-4333-8333-333333333333",
            creditsGranted: 3,
            grantedByEmail: "admin@preview.dev",
            source: "MANUAL",
            note: "베타 테스터",
            createdAt: new Date("2026-08-30T12:00:00Z"),
          },
        ]),
      },
    }));
    mocks.getEntitlementSummary.mockResolvedValue(SUMMARY);
    mocks.grantAdminCredits.mockResolvedValue(SUMMARY);
  });

  it("returns the summary and grant history for a user", async () => {
    const res = await invoke({ query: { userId: USER_ID } });

    expect(res.statusCode).toBe(200);
    expect(res.body.summary).toEqual(SUMMARY);
    expect(res.body.grants).toHaveLength(1);
    expect(res.body.grants[0]).toMatchObject({
      credits_granted: 3,
      granted_by_email: "admin@preview.dev",
      source: "MANUAL",
      note: "베타 테스터",
    });
  });

  it("rejects a GET without a valid userId", async () => {
    const res = await invoke({ query: { userId: "not-a-uuid" } });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when the recipient does not exist", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(null);
    const res = await invoke({ query: { userId: USER_ID } });
    expect(res.statusCode).toBe(404);
  });

  it("grants credits with the administrator identity attached", async () => {
    const res = await invoke({
      method: "POST",
      body: { userId: USER_ID, credits: 3, note: "베타 테스터 지급" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ summary: SUMMARY });
    expect(mocks.grantAdminCredits).toHaveBeenCalledWith(expect.anything(), {
      userId: USER_ID,
      credits: 3,
      note: "베타 테스터 지급",
      grantedByUserId: ADMIN.applicationUser.id,
      grantedByEmail: ADMIN.applicationUser.email,
    });
  });

  it("rejects invalid grant payloads", async () => {
    for (const body of [
      undefined,
      { userId: USER_ID },
      { userId: USER_ID, credits: 0 },
      { userId: USER_ID, credits: 1.5 },
      { userId: USER_ID, credits: 10001 },
      { userId: "nope", credits: 3 },
      { userId: USER_ID, credits: 3, note: 42 },
    ]) {
      const res = await invoke({ method: "POST", body });
      expect(res.statusCode).toBe(400);
    }
    expect(mocks.grantAdminCredits).not.toHaveBeenCalled();
  });

  it("rejects non-GET/POST methods", async () => {
    const res = await invoke({ method: "DELETE" });
    expect(res.statusCode).toBe(405);
  });

  it("propagates authentication failures without granting", async () => {
    mocks.requireAdministrator.mockRejectedValue(
      Object.assign(new Error("Administrator role required"), { statusCode: 403 }),
    );
    const res = await invoke({
      method: "POST",
      body: { userId: USER_ID, credits: 3 },
    });
    expect(res.statusCode).toBe(403);
    expect(mocks.grantAdminCredits).not.toHaveBeenCalled();
  });
});
