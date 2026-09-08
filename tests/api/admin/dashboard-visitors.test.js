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

const { default: dashboardHandler, readRangeDays } = await import("../../../lib/admin-handlers/dashboard.js");

function createResponse() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

describe("admin dashboard — 방문자 집계", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("분석을 돌리지 않은 방문도 site_visits 로 세고 analyses 로는 세지 않는다", async () => {
    const now = new Date();
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "visitor-a", createdAt: new Date(now.getTime() - 2 * MINUTE) },
      { visitorId: "visitor-a", createdAt: new Date(now.getTime() - 1 * MINUTE) },
      { visitorId: "visitor-b", createdAt: new Date(now.getTime() - 45 * MINUTE) },
    ]);
    // analyses 에 오늘 행이 있어도 방문자 수에는 영향이 없어야 한다.
    mocks.prisma.analysis.findMany.mockResolvedValue([{ userId: "u1", createdAt: now }]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.kpi.todayVisitors).toBe(2);
    expect(res.body.kpi.todayPageViews).toBe(3);
    expect(res.body.kpi.onlineUsers).toBe(1);
    expect(res.body.visitorChart).toHaveLength(7);
    expect(res.body.visitorChart.at(-1)).toEqual(expect.objectContaining({ visitors: 2, pageViews: 3 }));
  });

  it("days 로 과거 기간을 넓히면 차트와 조회 범위가 함께 늘어난다", async () => {
    const now = new Date();
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "old", createdAt: new Date(now.getTime() - 20 * DAY) },
      { visitorId: "today", createdAt: now },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: { days: "30" } }, res);

    expect(res.body.range).toEqual({ days: 30 });
    expect(res.body.visitorChart).toHaveLength(30);
    expect(res.body.signupChart).toHaveLength(30);
    expect(res.body.analysisChart).toHaveLength(30);
    expect(res.body.visitorChart.reduce((sum, point) => sum + point.visitors, 0)).toBe(2);
    expect(res.body.kpi.todayVisitors).toBe(1);

    const visitWhere = mocks.prisma.siteVisit.findMany.mock.calls[0][0].where.createdAt.gte;
    expect(now.getTime() - visitWhere.getTime()).toBeGreaterThanOrEqual(30 * DAY - MINUTE);
    const signupWhere = mocks.prisma.user.findMany.mock.calls[0][0].where.createdAt.gte;
    expect(now.getTime() - signupWhere.getTime()).toBeGreaterThanOrEqual(30 * DAY - MINUTE);
  });

  it("허용 목록 밖의 days 는 기본 7일로 돌린다", () => {
    expect(readRangeDays({ days: "90" })).toBe(90);
    expect(readRangeDays({ days: "365" })).toBe(7);
    expect(readRangeDays({ days: "abc" })).toBe(7);
    expect(readRangeDays({})).toBe(7);
  });
});
