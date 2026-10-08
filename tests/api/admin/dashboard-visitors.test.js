import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { createResponse } from "../../helpers/http.js";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// "오늘" 은 KST 자정 기준이라 실제 시계로 자정 직전에 돌리면 45분 전 방문이 어제로 넘어간다. KST 15시로 고정한다.
const FIXED_NOW = new Date("2026-09-10T06:00:00.000Z");

describe("admin dashboard — 방문자 집계", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXED_NOW);
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

  afterEach(() => {
    vi.useRealTimers();
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

  it("period=30d 면 표 칸이 30개로 늘고 조회 범위도 30일이 된다", async () => {
    const now = new Date();
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "old", createdAt: new Date(now.getTime() - 20 * DAY) },
      { visitorId: "today", createdAt: now },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: { period: "30d" } }, res);

    expect(res.body.range).toEqual({ period: "30d" });
    for (const key of ["visitorChart", "signupChart", "analysisChart", "paymentChart", "aiCostChart"]) {
      expect(res.body[key]).toHaveLength(30);
    }
    expect(res.body.visitorChart.reduce((sum, point) => sum + point.visitors, 0)).toBe(2);
    expect(res.body.kpi.todayVisitors).toBe(1);

    const visitWhere = mocks.prisma.siteVisit.findMany.mock.calls[0][0].where.createdAt.gte;
    expect(now.getTime() - visitWhere.getTime()).toBeGreaterThanOrEqual(29 * DAY);
    const signupWhere = mocks.prisma.user.findMany.mock.calls[0][0].where.createdAt.gte;
    expect(signupWhere.getTime()).toBe(visitWhere.getTime());
  });

  it("지난주를 골라도 오늘 카드는 오늘 기준이고, 표는 지난 월~일만 센다", async () => {
    // FIXED_NOW = 2026-09-10(목) 15시 KST → 지난주는 08/31(월) ~ 09/06(일)
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "last-week", createdAt: new Date("2026-09-02T03:00:00.000Z") },
      { visitorId: "sunday-night", createdAt: new Date("2026-09-06T14:59:00.000Z") },
      { visitorId: "monday", createdAt: new Date("2026-09-06T15:00:00.000Z") },
      { visitorId: "today", createdAt: new Date("2026-09-10T05:00:00.000Z") },
    ]);
    mocks.prisma.tokenUsage.findMany.mockResolvedValue([
      { cost: 0.5, createdAt: new Date("2026-09-02T03:00:00.000Z") },
      { cost: 0.25, createdAt: new Date("2026-09-10T05:00:00.000Z") },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: { period: "lastWeek" } }, res);

    expect(res.body.visitorChart.map((point) => point.date)).toEqual(["08/31", "09/01", "09/02", "09/03", "09/04", "09/05", "09/06"]);
    expect(res.body.visitorChart.reduce((sum, point) => sum + point.visitors, 0)).toBe(2);
    expect(res.body.kpi.todayVisitors).toBe(1);
    expect(res.body.kpi.todayAiCost).toBe(0.25);
    expect(res.body.aiCostChart.reduce((sum, point) => sum + point.cost, 0)).toBe(0.5);
    // 오늘 카드를 위해 조회는 오늘까지 열어 둔다.
    expect(mocks.prisma.siteVisit.findMany.mock.calls[0][0].where.createdAt.lt).toBeUndefined();
  });

  it("월별은 이번 달 포함 6개월 칸이고, 한 칸의 방문자는 그 달의 고유 방문자다", async () => {
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", createdAt: new Date("2026-09-01T03:00:00.000Z") },
      { visitorId: "a", createdAt: new Date("2026-09-05T03:00:00.000Z") },
      { visitorId: "b", createdAt: new Date("2026-08-15T03:00:00.000Z") },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: { period: "months" } }, res);

    expect(res.body.visitorChart.map((point) => point.date)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(res.body.visitorChart.at(-1)).toEqual({ date: "2026-09", visitors: 1, pageViews: 2 });
    expect(res.body.visitorChart.at(-2)).toEqual({ date: "2026-08", visitors: 1, pageViews: 1 });
  });

  it("허용 목록 밖의 period 는 최근 7일로 돌린다", async () => {
    const res = createResponse();
    await dashboardHandler({ method: "GET", query: { period: "365d" } }, res);

    expect(res.body.range).toEqual({ period: "7d" });
    expect(res.body.visitorChart).toHaveLength(7);
  });

  it("관리자 계정이 로그인한 적 있는 방문자 세션은 로그인 전 페이지까지 통째로 집계에서 뺀다", async () => {
    const now = new Date();
    mocks.prisma.user.findMany.mockImplementation(async ({ where }) => (where?.role === "admin" ? [{ id: "admin-1" }] : []));
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "me", userId: null, createdAt: now },
      { visitorId: "me", userId: "admin-1", createdAt: now },
      { visitorId: "guest", userId: null, createdAt: now },
      { visitorId: "member", userId: "user-2", createdAt: now },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.kpi.todayVisitors).toBe(2);
    expect(res.body.kpi.todayPageViews).toBe(2);
    expect(mocks.prisma.siteVisit.findMany.mock.calls[0][0].select).toEqual(expect.objectContaining({ userId: true }));
  });
});
