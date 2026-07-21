import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedUser: { id: "11111111-1111-4111-8111-111111111111" },
  getEntitlementSummary: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    entitlementSetting: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    purchaseIntent: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
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
const { default: purchaseIntentsHandler } = await import("../../api/entitlements/purchase-intents.js");
const { default: adminEntitlementsHandler } = await import("../../api/admin/entitlements.js");

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

async function invokeAdminEntitlements({
  authorization = "Bearer admin-token",
  body,
  method = "GET",
} = {}) {
  const response = createResponse();
  await adminEntitlementsHandler(
    { body, headers: { authorization }, method, url: "/api/admin/entitlements" },
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
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
    });
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      groblePaymentUrl: "https://payments.groble.example/checkout",
      premiumEnabled: false,
    });
    mocks.prisma.entitlementSetting.update.mockResolvedValue({
      premiumEnabled: true,
    });
    mocks.prisma.purchaseIntent.create.mockResolvedValue({ id: "purchase-intent-1" });
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "user" });
  });

  it("returns an entitlement summary for the verified token user, never body.userId", async () => {
    const response = await invokeEntitlements({
      body: { userId: "22222222-2222-4222-8222-222222222222" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      freeRemaining: 1,
      groblePaymentUrl: "https://payments.groble.example/checkout",
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

  it("creates a pending purchase intent owned by the verified token user", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      groblePaymentUrl: "https://payments.groble.example/checkout",
      premiumEnabled: true,
    });

    const response = await invokeEntitlements({
      body: { userId: "22222222-2222-4222-8222-222222222222" },
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      checkoutUrl: "https://payments.groble.example/checkout",
      purchaseIntentId: "purchase-intent-1",
    });
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: {
        status: "PENDING",
        userId: mocks.authenticatedUser.id,
      },
    });
  });

  it("rejects a purchase intent when premium sales are disabled", async () => {
    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "PREMIUM_SALES_DISABLED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("delegates the Vercel purchase-intent entry to the entitlement handler", () => {
    expect(purchaseIntentsHandler).toBe(entitlementsHandler);
  });

  it("returns the documented JSON 405 for unsupported entitlement subpaths", async () => {
    const response = await invokeEntitlements({ path: "/api/entitlements/unknown" });

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({ error: "Method Not Allowed" });
  });

  it("rejects a non-admin attempt to enable premium", async () => {
    const response = await invokeAdminEntitlements({
      body: { premiumEnabled: true },
      method: "PATCH",
    });

    expect(response.statusCode).toBe(403);
    expect(mocks.prisma.entitlementSetting.update).not.toHaveBeenCalled();
  });

  it("lets a verified administrator update only premiumEnabled", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ role: "admin" });

    const response = await invokeAdminEntitlements({
      body: { premiumEnabled: true },
      method: "PATCH",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ premiumEnabled: true });
    expect(mocks.prisma.entitlementSetting.update).toHaveBeenCalledWith({
      data: { premiumEnabled: true },
      where: { id: "singleton" },
    });
  });
});
