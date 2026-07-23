import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: { id: "11111111-1111-4111-8111-111111111111" },
  getEntitlementSummary: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
  },
  requireAuthenticatedUser: vi.fn(),
  transaction: {},
}));

vi.mock("../../lib/analysis-entitlements.js", () => ({
  getEntitlementSummary: mocks.getEntitlementSummary,
}));

vi.mock("../../lib/auth.js", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: entitlementsHandler } = await import("../../api/entitlements.js");

function createResponse() {
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

async function invokeEntitlements({
  authorization = "Bearer valid-token",
  body,
  method = "GET",
  path = "/api/entitlements",
} = {}) {
  const response = createResponse();
  await entitlementsHandler(
    { body, headers: { authorization }, method, url: path },
    response,
  );
  return response;
}

describe("entitlement APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.authenticatedUser);
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.transaction));
    mocks.getEntitlementSummary.mockResolvedValue({
      freeRemaining: 1,
      bonusRemaining: 0,
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
    });
  });

  it("returns an entitlement summary for the verified token user, never body.userId", async () => {
    const response = await invokeEntitlements({
      body: { userId: "22222222-2222-4222-8222-222222222222" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      freeRemaining: 1,
      bonusRemaining: 0,
      groblePaymentUrl: null,
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
    });
    expect(mocks.getEntitlementSummary).toHaveBeenCalledWith(
      mocks.transaction,
      mocks.authenticatedUser.id,
    );
  });

  it("rejects requests without a valid token", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(null);

    const response = await invokeEntitlements({ authorization: "Bearer invalid-token" });

    expect(response.statusCode).toBe(401);
  });

  it("does not create purchase intents during beta", async () => {
    const response = await invokeEntitlements({
      body: { userId: "22222222-2222-4222-8222-222222222222" },
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method Not Allowed" });
  });

  it("returns the documented JSON 405 for unsupported entitlement subpaths", async () => {
    const response = await invokeEntitlements({ path: "/api/entitlements/unknown" });

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method Not Allowed" });
  });

});
