import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grantGroblePurchase: vi.fn(),
  logger: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    paymentEntitlement: {
      findUnique: vi.fn(),
    },
    purchaseIntent: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("../../lib/analysis-entitlements.js", () => ({
  grantGroblePurchase: mocks.grantGroblePurchase,
}));

vi.mock("../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { createGrobleWebhookHandler } = await import("../../lib/groble-webhook-handler.js");

const CONTENT_ID = "premium-product-id";
const INTENT_ID = "11111111-1111-4111-8111-111111111111";
const NOW = 1_785_091_200_000;
const SECRET = "groble-webhook-secret";
const USER_ID = "22222222-2222-4222-8222-222222222222";

function createResponse() {
  return {
    body: undefined,
    statusCode: 200,
    end() {
      return this;
    },
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

function paidPayload({ object = {}, ...overrides } = {}) {
  return {
    id: "evt_groble_100",
    type: "payment.completed",
    data: {
      object: {
        buyer: { email: "buyer@example.com", phoneNumber: "010-1234-5678" },
        content: { id: CONTENT_ID },
        merchantUid: "groble-100",
        payment: { purchasedAt: "2026-07-27T00:00:00.000Z" },
        sellerReference: INTENT_ID,
        ...object,
      },
    },
    ...overrides,
  };
}

function signedHeaders(rawBody, timestamp = String(NOW / 1000)) {
  return {
    "x-groble-signature": createHmac("sha256", SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex"),
    "x-groble-timestamp": timestamp,
  };
}

function createHandler() {
  return createGrobleWebhookHandler({
    logger: mocks.logger,
    now: () => NOW,
    premiumContentId: CONTENT_ID,
    prismaClient: mocks.prisma,
    webhookSecret: SECRET,
  });
}

async function invokeGrobleWebhook({
  handler = createHandler(),
  headers,
  method = "POST",
  payload = paidPayload(),
  rawBody = JSON.stringify(payload),
} = {}) {
  const response = createResponse();
  await handler(
    {
      headers: headers ?? signedHeaders(rawBody),
      method,
      rawBody,
      url: "/api/webhooks/groble",
    },
    response,
  );
  return response;
}

describe("Groble webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.prisma));
    mocks.prisma.paymentEntitlement.findUnique.mockResolvedValue(null);
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: INTENT_ID,
      status: "PENDING",
      userId: USER_ID,
    });
    mocks.prisma.purchaseIntent.updateMany.mockResolvedValue({ count: 1 });
    mocks.grantGroblePurchase.mockResolvedValue({ credits: 3, granted: true });
  });

  it("grants the intent owner three credits for one valid signed premium payment", async () => {
    const response = await invokeGrobleWebhook();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ grantedCredits: 3, ok: true });
    expect(mocks.prisma.purchaseIntent.updateMany).toHaveBeenCalledWith({
      data: { status: "PAID" },
      where: { id: INTENT_ID, status: "PENDING" },
    });
    expect(mocks.grantGroblePurchase).toHaveBeenCalledWith(mocks.prisma, {
      providerPaymentId: "groble-100",
      rawEvent: {
        contentId: CONTENT_ID,
        eventId: "evt_groble_100",
        merchantUid: "groble-100",
        purchasedAt: "2026-07-27T00:00:00.000Z",
        type: "payment.completed",
      },
      userId: USER_ID,
    });
    expect(JSON.stringify(mocks.grantGroblePurchase.mock.calls)).not.toContain("buyer@example.com");
    expect(JSON.stringify(mocks.grantGroblePurchase.mock.calls)).not.toContain("010-1234-5678");
    expect(JSON.stringify(mocks.grantGroblePurchase.mock.calls)).not.toContain(INTENT_ID);
  });

  it("rejects an altered signature before opening a transaction", async () => {
    const payload = paidPayload();
    const rawBody = JSON.stringify(payload);
    const response = await invokeGrobleWebhook({
      headers: { ...signedHeaders(rawBody), "x-groble-signature": "0".repeat(64) },
      payload,
      rawBody,
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe("GROBLE_WEBHOOK_SIGNATURE_INVALID");
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a signed delivery whose timestamp is more than five minutes old", async () => {
    const payload = paidPayload();
    const rawBody = JSON.stringify(payload);
    const response = await invokeGrobleWebhook({
      headers: signedHeaders(rawBody, String(NOW / 1000 - 301)),
      payload,
      rawBody,
    });

    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe("GROBLE_WEBHOOK_TIMESTAMP_INVALID");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a signed event type other than payment.completed", async () => {
    const response = await invokeGrobleWebhook({
      payload: paidPayload({ type: "payment.refunded" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("UNSUPPORTED_GROBLE_EVENT");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a signed payment that omits its merchant payment id", async () => {
    const response = await invokeGrobleWebhook({
      payload: paidPayload({ object: { merchantUid: undefined } }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("MALFORMED_GROBLE_PAID_EVENT");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a valid payment for another Groble product", async () => {
    const response = await invokeGrobleWebhook({
      payload: paidPayload({ object: { content: { id: "another-product" } } }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe("UNEXPECTED_GROBLE_PRODUCT");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a valid payment with an unknown purchase reference", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue(null);

    const response = await invokeGrobleWebhook();

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe("UNLINKED_PURCHASE_INTENT");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a buyer-altered non-UUID purchase reference without querying Prisma", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockRejectedValue(new Error("invalid UUID"));

    const response = await invokeGrobleWebhook({
      payload: paidPayload({ object: { sellerReference: "buyer-altered-reference" } }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe("UNLINKED_PURCHASE_INTENT");
    expect(mocks.prisma.purchaseIntent.findUnique).not.toHaveBeenCalled();
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a valid payment for a cancelled purchase intent", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: INTENT_ID,
      status: "CANCELLED",
      userId: USER_ID,
    });

    const response = await invokeGrobleWebhook();

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe("INVALID_PURCHASE_INTENT_STATUS");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("acknowledges a repeated provider payment without granting credits twice", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: INTENT_ID,
      status: "PAID",
      userId: USER_ID,
    });
    mocks.prisma.paymentEntitlement.findUnique.mockResolvedValue({ id: "existing-payment" });

    const response = await invokeGrobleWebhook();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ grantedCredits: 0, ok: true });
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a new provider payment against an already paid intent", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: INTENT_ID,
      status: "PAID",
      userId: USER_ID,
    });

    const response = await invokeGrobleWebhook({
      payload: paidPayload({ object: { merchantUid: "groble-101" } }),
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe("PURCHASE_INTENT_ALREADY_PAID");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("accepts only POST requests", async () => {
    const response = await invokeGrobleWebhook({ method: "GET" });

    expect(response.statusCode).toBe(405);
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });
});
