import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  grantGroblePurchase: vi.fn(),
  logger: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    purchaseIntent: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../../../lib/analysis-entitlements.js", () => ({
  grantGroblePurchase: mocks.grantGroblePurchase,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { createGrobleWebhookHandler, parseGroblePaidEvent } = await import("../../../api/webhooks/groble.js");

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

function verifiedPaidEvent(overrides = {}) {
  return {
    amount: 9900,
    providerPaymentId: "groble-100",
    purchaseIntentId: "11111111-1111-4111-8111-111111111111",
    rawEvent: { fixture: "verified-paid-event" },
    ...overrides,
  };
}

function invokeGrobleWebhook({ body = {}, handler, method = "POST" } = {}) {
  const response = createResponse();
  return handler(
    { body, headers: {}, method, url: "/api/webhooks/groble" },
    response,
  ).then(() => response);
}

function createVerifiedEventHandler(event = verifiedPaidEvent()) {
  return createGrobleWebhookHandler({
    logger: mocks.logger,
    parsePaidEvent: vi.fn().mockResolvedValue(event),
  });
}

describe("Groble webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockImplementation((callback) => callback(mocks.prisma));
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      status: "PENDING",
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.prisma.purchaseIntent.update.mockResolvedValue({ status: "PAID" });
    mocks.grantGroblePurchase.mockResolvedValue({ credits: 3, granted: true });
  });

  it("grants three credits for one verified paid event", async () => {
    const response = await invokeGrobleWebhook({
      handler: createVerifiedEventHandler(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ grantedCredits: 3, ok: true });
    expect(mocks.grantGroblePurchase).toHaveBeenCalledWith(mocks.prisma, {
      providerPaymentId: "groble-100",
      rawEvent: { fixture: "verified-paid-event" },
      userId: "22222222-2222-4222-8222-222222222222",
    });
    expect(mocks.prisma.purchaseIntent.update).toHaveBeenCalledWith({
      data: { status: "PAID" },
      where: { id: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("does not grant a second time for the same payment id", async () => {
    mocks.grantGroblePurchase.mockResolvedValue({ credits: 0, granted: false });

    const response = await invokeGrobleWebhook({
      handler: createVerifiedEventHandler(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ grantedCredits: 0, ok: true });
  });

  it("does not infer a paid event from plausible unknown Groble fields", async () => {
    const payload = {
      data: {
        paymentId: "groble-100",
        purchaseIntentId: "11111111-1111-4111-8111-111111111111",
      },
      event: "일반결제 완료",
    };

    await expect(parseGroblePaidEvent(payload, {})).resolves.toBeNull();
    const response = await invokeGrobleWebhook({
      body: payload,
      handler: createGrobleWebhookHandler({ logger: mocks.logger }),
    });

    expect(response.statusCode).toBe(204);
    expect(mocks.logger).toHaveBeenCalledWith(
      "[api/webhooks/groble] ignored event",
      expect.objectContaining({ dataKeys: ["paymentId", "purchaseIntentId"] }),
    );
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("rejects a malformed body without granting credits", async () => {
    const response = await invokeGrobleWebhook({
      body: null,
      handler: createGrobleWebhookHandler({ logger: mocks.logger }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("MALFORMED_GROBLE_PAYLOAD");
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });

  it("records a safe diagnostic and rejects an unlinked paid event", async () => {
    mocks.prisma.purchaseIntent.findUnique.mockResolvedValue(null);

    const response = await invokeGrobleWebhook({
      handler: createVerifiedEventHandler(),
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.error).toBe("UNLINKED_PURCHASE_INTENT");
    expect(response.body.correlationId).toEqual(expect.any(String));
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
    expect(mocks.logger).toHaveBeenCalledWith(
      "[api/webhooks/groble] rejected event",
      expect.objectContaining({ code: "UNLINKED_PURCHASE_INTENT" }),
    );
    expect(JSON.stringify(mocks.logger.mock.calls)).not.toContain("groble-100");
    expect(JSON.stringify(mocks.logger.mock.calls)).not.toContain(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("accepts only POST requests", async () => {
    const response = await invokeGrobleWebhook({
      handler: createVerifiedEventHandler(),
      method: "GET",
    });

    expect(response.statusCode).toBe(405);
    expect(mocks.grantGroblePurchase).not.toHaveBeenCalled();
  });
});
