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
    getEntitlementSummaryReadOnly: vi.fn(),
    hasClaimedFeedbackReward: vi.fn(),
    grobleWebhookHandler: vi.fn(),
    prisma: {
      $transaction: vi.fn(),
      entitlementSetting: { findUnique: vi.fn() },
      purchaseProductSetting: { findMany: vi.fn() },
      purchaseIntent: { create: vi.fn() },
    },
    requireActiveApplicationUser: vi.fn(),
    transaction: {},
  };
});

vi.mock("../../lib/analysis-entitlements.js", () => ({
  getEntitlementSummaryReadOnly: mocks.getEntitlementSummaryReadOnly,
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
const SINGLE_CHECKOUT_URL = "https://www.groble.im/payment/SINGLE";
const COMPANY_CHECKOUT_URL = "https://www.groble.im/payment/COMPANY";
const PREMIUM_CHECKOUT_URL = "https://www.groble.im/payment/PREMIUM";
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

// 상품별 Groble 연결 행. 특정 상품만 덮어써서 테스트별 시나리오를 만든다.
function buildProductRows(overrides = {}) {
  const base = {
    SINGLE: { product: "SINGLE", grobleContentId: "6HteWn", paymentUrl: SINGLE_CHECKOUT_URL, active: true },
    COMPANY_SINGLE: {
      product: "COMPANY_SINGLE",
      grobleContentId: "cmp001",
      paymentUrl: COMPANY_CHECKOUT_URL,
      active: true,
    },
    STANDARD: { product: "STANDARD", grobleContentId: "4SGBV5", paymentUrl: CHECKOUT_URL, active: true },
    PREMIUM: { product: "PREMIUM", grobleContentId: "prm001", paymentUrl: PREMIUM_CHECKOUT_URL, active: true },
    TRIPLE: { product: "TRIPLE", grobleContentId: null, paymentUrl: "", active: false },
  };
  for (const [product, patch] of Object.entries(overrides)) {
    base[product] = { ...base[product], ...patch };
  }
  return Object.values(base);
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
      premiumEnabled: false,
      companyAnalysisEnabled: false,
    });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(buildProductRows());
    mocks.prisma.purchaseIntent.create.mockResolvedValue({ id: INTENT_ID });
    mocks.hasClaimedFeedbackReward.mockResolvedValue(false);
    mocks.getEntitlementSummaryReadOnly.mockResolvedValue({
      freeRemaining: 1,
      bonusRemaining: 0,
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
      companyAnalysisEnabled: false,
      companyRemaining: 0,
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
      grobleSinglePaymentUrl: null,
      checkoutUrls: { single: null, company: null, standard: null, premium: null, triple: null },
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
      feedbackRewardClaimed: false,
      companyAnalysisEnabled: false,
      companyRemaining: 0,
    });
    // 조회 전용 요약 — 잠금 트랜잭션을 거치지 않고 prisma 로 바로 읽는다.
    expect(mocks.getEntitlementSummaryReadOnly).toHaveBeenCalledWith(
      mocks.prisma,
      mocks.authenticatedUser.id,
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });

  it("passes the company analysis pool through to the summary response", async () => {
    mocks.getEntitlementSummaryReadOnly.mockResolvedValue({
      freeRemaining: 0,
      bonusRemaining: 0,
      premiumEnabled: true,
      premiumRemaining: 2,
      remaining: 2,
      companyAnalysisEnabled: true,
      companyRemaining: 1,
    });

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({
      remaining: 2,
      companyAnalysisEnabled: true,
      companyRemaining: 1,
    });
  });

  it("exposes the checkout URLs only while premium sales are enabled", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: true,
    });
    mocks.getEntitlementSummaryReadOnly.mockResolvedValue({
      freeRemaining: 0,
      bonusRemaining: 0,
      premiumEnabled: true,
      premiumRemaining: 3,
      remaining: 3,
    });

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.checkoutUrls).toEqual({
      single: SINGLE_CHECKOUT_URL,
      company: COMPANY_CHECKOUT_URL,
      standard: CHECKOUT_URL,
      premium: PREMIUM_CHECKOUT_URL,
      triple: null, // 판매 종료(행 비활성·URL 없음)
    });
    expect(response.body.groblePaymentUrl).toBe(CHECKOUT_URL);
    expect(response.body.grobleSinglePaymentUrl).toBe(SINGLE_CHECKOUT_URL);
  });

  it("hides an unconfigured single-plan checkout URL even while sales are enabled", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: true,
    });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(
      buildProductRows({ SINGLE: { paymentUrl: "" } }),
    );

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.checkoutUrls.single).toBeNull();
    expect(response.body.groblePaymentUrl).toBe(CHECKOUT_URL);
    expect(response.body.grobleSinglePaymentUrl).toBeNull();
  });

  it("exposes company product checkout URLs only while the company analysis switch is on", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: true });

    const response = await invokeEntitlements();

    expect(response.statusCode).toBe(200);
    expect(response.body.checkoutUrls).toEqual({
      single: SINGLE_CHECKOUT_URL,
      company: COMPANY_CHECKOUT_URL,
      standard: CHECKOUT_URL,
      premium: PREMIUM_CHECKOUT_URL,
      triple: null, // 판매 종료(행 비활성·URL 없음)
    });
  });

  it("hides the standard tier while the company analysis switch is off because it includes a company credit", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: false });

    const response = await invokeEntitlements();

    expect(response.body.checkoutUrls.standard).toBeNull();
    expect(response.body.groblePaymentUrl).toBeNull();
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

  it("refuses a premium purchase while the company analysis switch is off", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: false });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=premium",
      query: { product: "premium" },
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "COMPANY_SALES_DISABLED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("refuses purchase intents when no checkout URL is configured", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: true,
    });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(
      buildProductRows({ STANDARD: { paymentUrl: "" } }),
    );

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents",
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("creates a purchase intent for the token user and stamps its id on the checkout URL", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: true,
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
    // product 파라미터가 없으면 구 클라이언트가 3회권 결제로 쓰던 경로를 승계한 STANDARD 다.
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: { product: "STANDARD", status: "PENDING", userId: mocks.authenticatedUser.id },
    });
  });

  it("creates a single-plan purchase intent against the single checkout URL", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: false,
    });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=single",
      query: { product: "single" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      purchaseIntentId: INTENT_ID,
      checkoutUrl: `${SINGLE_CHECKOUT_URL}?ref=${INTENT_ID}`,
    });
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: { product: "SINGLE", status: "PENDING", userId: mocks.authenticatedUser.id },
    });
  });

  it("creates a company-single purchase intent against its own checkout URL", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: true });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=company",
      query: { product: "company" },
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.prisma.purchaseIntent.create).toHaveBeenCalledWith({
      data: { product: "COMPANY_SINGLE", status: "PENDING", userId: mocks.authenticatedUser.id },
    });
    expect(response.body).toEqual({ purchaseIntentId: INTENT_ID, checkoutUrl: `${COMPANY_CHECKOUT_URL}?ref=${INTENT_ID}` });
  });

  it("refuses the retired triple product even when sales are on", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: true, companyAnalysisEnabled: true });

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=triple",
      query: { product: "triple" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
  });

  it("refuses a single-plan purchase while its checkout URL is unconfigured", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: false,
    });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(
      buildProductRows({ SINGLE: { paymentUrl: "" } }),
    );

    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=single",
      query: { product: "single" },
    });

    expect(response.statusCode).toBe(503);
    expect(response.body).toEqual({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
  });

  it("refuses a product whose content id is unknown even when its URL is set", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: true,
    });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(
      buildProductRows({ COMPANY_SINGLE: { grobleContentId: null, paymentUrl: COMPANY_CHECKOUT_URL, active: true } }),
    );

    const purchaseResponse = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=company",
      query: { product: "company" },
    });

    expect(purchaseResponse.statusCode).toBe(503);
    expect(purchaseResponse.body).toEqual({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();

    const summaryResponse = await invokeEntitlements();
    expect(summaryResponse.body.checkoutUrls.company).toBeNull();
  });

  it("refuses an inactive product even when its URL and content id are set", async () => {
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({
      premiumEnabled: true,
      companyAnalysisEnabled: true,
    });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(
      buildProductRows({ STANDARD: { active: false, grobleContentId: "4SGBV5", paymentUrl: CHECKOUT_URL } }),
    );

    const purchaseResponse = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=standard",
      query: { product: "standard" },
    });

    expect(purchaseResponse.statusCode).toBe(503);
    expect(purchaseResponse.body).toEqual({ error: "PREMIUM_CHECKOUT_NOT_CONFIGURED" });
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();

    const summaryResponse = await invokeEntitlements();
    expect(summaryResponse.body.checkoutUrls.standard).toBeNull();
  });

  it("rejects unknown purchase products before touching settings or the database", async () => {
    const response = await invokeEntitlements({
      method: "POST",
      path: "/api/entitlements/purchase-intents?product=decade",
      query: { product: "decade" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "INVALID_PURCHASE_PRODUCT" });
    expect(mocks.prisma.entitlementSetting.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.purchaseIntent.create).not.toHaveBeenCalled();
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
