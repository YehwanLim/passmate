import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AuthorizationError extends Error {
    constructor(code, statusCode, message) {
      super(message);
      this.name = "AuthorizationError";
      this.code = code;
      this.statusCode = statusCode;
    }
  }

  return {
    AuthorizationError,
    authenticatedUser: { id: "11111111-1111-4111-8111-111111111111" },
    getEntitlementSummary: vi.fn(),
    hasClaimedFeedbackReward: vi.fn(),
    grobleWebhookHandler: vi.fn(),
    prisma: {
      $transaction: vi.fn(),
      entitlementSetting: { findUnique: vi.fn() },
      purchaseIntent: { create: vi.fn() },
    },
    requireActiveApplicationUser: vi.fn(),
    transaction: {},
  };
});

vi.mock("../../lib/analysis-entitlements.js", () => ({
  getEntitlementSummary: mocks.getEntitlementSummary,
  hasClaimedFeedbackReward: mocks.hasClaimedFeedbackReward,
}));

vi.mock("../../lib/auth.js", () => ({
  AuthorizationError: mocks.AuthorizationError,
  requireActiveApplicationUser: mocks.requireActiveApplicationUser,
}));

vi.mock("../../lib/groble-webhook-handler.js", () => ({
  default: mocks.grobleWebhookHandler,
}));

vi.mock("../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: entitlementsHandler } = await import("../../api/entitlements.js");

const CHECKOUT_URL = "https://www.groble.im/payment/4SGBV5";
const INTENT_ID = "33333333-3333-4333-8333-333333333333";

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
  query,
} = {}) {
  const response = createResponse();
  await entitlementsHandler(
    { body, headers: { authorization }, method, query, url: path },
    response,
  );
  return response;
}

describe("entitlement APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveApplicationUser.mockResolvedValue({
      authenticatedUser: mocks.authenticatedUser,
      applicationUser: { id: mocks.authenticatedUser.id, deletionRequestedAt: null, role: "user" },
    });
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.transaction));
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      groblePaymentUrl: CHECKOUT_URL,
      premiumEnabled: false,
    });
    mocks.prisma.purchaseIntent.create.mockResolvedValue({ id: INTENT_ID });
    mocks.hasClaimedFeedbackReward.mockResolvedValue(false);
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
      feedbackRewardClaimed: false,
    });
    expect(mocks.getEntitlementSummary).toHaveBeenCalledWith(
      mocks.transaction,
      mocks.authenticatedUser.id,
    );
  });

  it("exposes the checkout URL only while premium sales are enabled", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      groblePaymentUrl: CHECKOUT_URL,
      premiumEnabled: true,
    });
    mocks.getEntitlementSummary.mockResolvedValue({
      freeRemaining: 0,
      bonusRemaining: 0,
      premiumEnabled: true,
      premiumRemaining: 3,
      remaining: 3,
    });

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.groblePaymentUrl).toBe(CHECKOUT_URL);
  });

  it("rejects requests without a valid token", async () => {
    mocks.requireActiveApplicationUser.mockRejectedValue(
      new mocks.AuthorizationError("AUTHENTICATION_REQUIRED", 401, "Unauthorized"),
    );

    const response = await invokeEntitlements({ authorization: "Bearer invalid-token" });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "AUTHENTICATION_REQUIRED" });
  });

  it("rejects deletion-pending accounts from every entitlement action", async () => {
    mocks.requireActiveApplicationUser.mockRejectedValue(
      new mocks.AuthorizationError("ACCOUNT_DELETION_PENDING", 403, "Account unavailable"),
    );

    const summaryResponse = await invokeEntitlements();
    expect(summaryResponse.statusCode).toBe(403);
    expect(summaryResponse.body).toEqual({ error: "ACCOUNT_DELETION_PENDING" });

    const purchaseResponse = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });
    expect(purchaseResponse.statusCode).toBe(403);
    expect(purchaseResponse.body).toEqual({ error: "ACCOUNT_DELETION_PENDING" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("refuses purchase intents while premium sales are disabled", async () => {
    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "PREMIUM_SALES_DISABLED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("refuses purchase intents when no checkout URL is configured", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      groblePaymentUrl: "",
      premiumEnabled: true,
    });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(503);
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("creates a purchase intent for the token user and stamps its id on the checkout URL", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      groblePaymentUrl: CHECKOUT_URL,
      premiumEnabled: true,
    });

    const response = await invokeEntitlements({
      body: { userId: "22222222-2222-4222-8222-222222222222" },
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      purchaseIntentId: INTENT_ID,
      checkoutUrl: `${CHECKOUT_URL}?ref=${INTENT_ID}`,
    });
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: { status: "PENDING", userId: mocks.authenticatedUser.id },
    });
  });

  it("routes the rewritten purchase-intents query through the same gate", async () => {
    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements?purchaseIntent=1",
      query: { purchaseIntent: "1" },
    });

    expect(response.statusCode).toBe(403);
  });

  it("dispatches the Groble webhook branch before user authentication", async () => {
    mocks.grobleWebhookHandler.mockImplementation(async (req, res) =>
      res.status(200).json({ ok: true, grantedCredits: 3 }),
    );

    const response = await invokeEntitlements({
      authorization: undefined,
      method: "POST",
      path: "/api/entitlements?grobleWebhook=1",
      query: { grobleWebhook: "1" },
    });

    expect(response.statusCode).toBe(200);
    expect(mocks.grobleWebhookHandler).toHaveBeenCalled();
    expect(mocks.requireActiveApplicationUser).not.toHaveBeenCalled();
  });

  it("returns the documented JSON 405 for unsupported entitlement subpaths", async () => {
    const response = await invokeEntitlements({ path: "/api/entitlements/unknown" });

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method Not Allowed" });
  });
});
