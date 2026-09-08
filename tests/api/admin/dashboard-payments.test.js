import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    analysis: { count: vi.fn(), findMany: vi.fn() },
    tokenUsage: { findMany: vi.fn() },
    siteVisit: { findMany: vi.fn() },
    paymentEntitlement: { findMany: vi.fn() },
    purchaseProductSetting: { findMany: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: dashboardHandler } = await import("../../../lib/admin-handlers/dashboard.js");

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

describe("admin dashboard — 결제 요약", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROBLE_PREMIUM_CONTENT_ID = PREMIUM_CONTENT_ID;
    process.env.GROBLE_SINGLE_CONTENT_ID = SINGLE_CONTENT_ID;
    mocks.requireAdministrator.mockResolvedValue({});
    mocks.prisma.user.count.mockResolvedValue(0);
    mocks.prisma.analysis.count.mockResolvedValue(0);
    mocks.prisma.user.findMany.mockResolvedValue([]);
    mocks.prisma.analysis.findMany.mockResolvedValue([]);
    mocks.prisma.tokenUsage.findMany.mockResolvedValue([]);
    mocks.prisma.siteVisit.findMany.mockResolvedValue([]);
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([]);
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue([]);
  });

  it("상품별 결제 건수를 센다", async () => {
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([
      { createdAt: new Date("2026-08-30T01:46:00+09:00"), rawEvent: { contentId: PREMIUM_CONTENT_ID } },
      { createdAt: new Date("2026-09-03T00:35:00+09:00"), rawEvent: { contentId: PREMIUM_CONTENT_ID } },
      { createdAt: new Date("2026-09-03T12:00:00+09:00"), rawEvent: { product: "SINGLE" } },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.paymentSummary.total).toBe(3);
    expect(res.body.paymentSummary.byProduct).toEqual({
      SINGLE: 1, COMPANY_SINGLE: 0, STANDARD: 0, PREMIUM: 0, TRIPLE: 2, UNKNOWN: 0,
    });
  });

  it("상품을 알 수 없는 결제는 따로 센다", async () => {
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([
      { createdAt: new Date("2026-09-03T12:00:00+09:00"), rawEvent: { contentId: "ZZZZZZ" } },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.paymentSummary.byProduct.UNKNOWN).toBe(1);
  });

  it("오늘 들어온 결제만 today 로 센다", async () => {
    const now = new Date();
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([
      { createdAt: now, rawEvent: { product: "SINGLE" } },
      { createdAt: new Date("2026-08-30T01:46:00+09:00"), rawEvent: { product: "TRIPLE" } },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.paymentSummary.today).toBe(1);
  });

  it("결제가 없으면 0 으로 채운다", async () => {
    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.paymentSummary).toEqual({
      total: 0,
      today: 0,
      byProduct: { SINGLE: 0, COMPANY_SINGLE: 0, STANDARD: 0, PREMIUM: 0, TRIPLE: 0, UNKNOWN: 0 },
    });
  });

  it("컷오버 후에는 같은 결제가 STANDARD 로 세어진다", async () => {
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue([
      { product: "STANDARD", grobleContentId: PREMIUM_CONTENT_ID, paymentUrl: "", active: true },
    ]);
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([
      { createdAt: new Date("2026-08-30T01:46:00+09:00"), rawEvent: { contentId: PREMIUM_CONTENT_ID } },
      { createdAt: new Date("2026-09-03T00:35:00+09:00"), rawEvent: { contentId: PREMIUM_CONTENT_ID } },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.paymentSummary.byProduct).toEqual({
      SINGLE: 0, COMPANY_SINGLE: 0, STANDARD: 2, PREMIUM: 0, TRIPLE: 0, UNKNOWN: 0,
    });
  });
});
