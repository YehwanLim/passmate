import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    tokenUsage: { findMany: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: userDetailHandler } = await import("../../../lib/admin-handlers/user-detail.js");

const USER_ID = "22222222-2222-4222-8222-222222222222";
const PREMIUM_CONTENT_ID = "4SGBV5";
const SINGLE_CONTENT_ID = "6HteWn";

function createResponse() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function userRecord(overrides = {}) {
  return {
    id: USER_ID,
    email: "buyer@example.com",
    name: "구매자",
    avatarUrl: null,
    role: "USER",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    _count: { analyses: 0, projects: 0, feedbacks: 0 },
    analyses: [],
    feedbacks: [],
    paymentEntitlements: [],
    purchaseIntents: [],
    ...overrides,
  };
}

describe("admin user detail — 결제 정보", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROBLE_PREMIUM_CONTENT_ID = PREMIUM_CONTENT_ID;
    process.env.GROBLE_SINGLE_CONTENT_ID = SINGLE_CONTENT_ID;
    mocks.requireAdministrator.mockResolvedValue({});
    mocks.prisma.tokenUsage.findMany.mockResolvedValue([]);
  });

  it("결제 기록에 저장된 상품을 그대로 내려준다", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      userRecord({
        paymentEntitlements: [
          {
            id: "pay-1",
            creditsGranted: 1,
            createdAt: new Date("2026-09-04T02:00:00Z"),
            providerPaymentId: "2026090400000000001",
            rawEvent: { product: "SINGLE", contentId: SINGLE_CONTENT_ID },
          },
        ],
      })
    );

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.payments).toEqual([
      {
        id: "pay-1",
        product: "SINGLE",
        credits_granted: 1,
        provider_payment_id: "2026090400000000001",
        created_at: new Date("2026-09-04T02:00:00Z"),
      },
    ]);
  });

  it("상품 구분이 없던 옛 결제는 contentId 로 3회권임을 되짚는다", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      userRecord({
        paymentEntitlements: [
          {
            id: "pay-old",
            creditsGranted: 3,
            createdAt: new Date("2026-08-29T16:46:35Z"),
            providerPaymentId: "2026083001461017500",
            rawEvent: { contentId: PREMIUM_CONTENT_ID, type: "payment.completed" },
          },
        ],
      })
    );

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    expect(res.body.payments[0].product).toBe("TRIPLE");
  });

  it("알 수 없는 상품이면 지어내지 않고 null 로 둔다", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      userRecord({
        paymentEntitlements: [
          {
            id: "pay-unknown",
            creditsGranted: 3,
            createdAt: new Date("2026-08-29T16:46:35Z"),
            providerPaymentId: "unknown-1",
            rawEvent: { contentId: "ZZZZZZ" },
          },
        ],
      })
    );

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    expect(res.body.payments[0].product).toBeNull();
    expect(res.body.payments[0].credits_granted).toBe(3);
  });

  it("완료되지 않은 구매 시도를 따로 내려준다", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(
      userRecord({
        purchaseIntents: [
          {
            id: "intent-1",
            product: "TRIPLE",
            status: "PENDING",
            createdAt: new Date("2026-09-02T10:00:00Z"),
          },
        ],
      })
    );

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    expect(res.body.pending_purchases).toEqual([
      {
        id: "intent-1",
        product: "TRIPLE",
        status: "PENDING",
        created_at: new Date("2026-09-02T10:00:00Z"),
      },
    ]);
  });

  it("결제 완료된 구매 의도는 미완료 목록에서 제외한다", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(userRecord());

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    const select = mocks.prisma.user.findUnique.mock.calls[0][0].select;
    expect(select.purchaseIntents.where.status).toEqual({ not: "PAID" });
  });

  it("결제가 없으면 빈 목록을 준다", async () => {
    mocks.prisma.user.findUnique.mockResolvedValue(userRecord());

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    expect(res.body.payments).toEqual([]);
    expect(res.body.pending_purchases).toEqual([]);
  });

  it("관리자가 아니면 결제 정보를 조회하지 않는다", async () => {
    mocks.requireAdministrator.mockRejectedValue(
      Object.assign(new Error("forbidden"), { statusCode: 403, code: "FORBIDDEN" })
    );

    const res = createResponse();
    await userDetailHandler({ method: "GET", query: { id: USER_ID } }, res);

    expect(mocks.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(res.statusCode).not.toBe(200);
  });
});
