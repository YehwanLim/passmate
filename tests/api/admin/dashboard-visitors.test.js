import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    analysis: { count: vi.fn(), findMany: vi.fn() },
    tokenUsage: { findMany: vi.fn() },
    siteVisit: { findMany: vi.fn() },
    clientEvent: { groupBy: vi.fn() },
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
    mocks.prisma.clientEvent.groupBy.mockResolvedValue([]);
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

  it("유입원은 utm_source 우선·referrer 호스트로 묶어 고유 방문자를 세고, 없는 방문자는 직접 유입으로 남긴다", async () => {
    const now = new Date();
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", createdAt: now, referrer: "https://blog.naver.com/hansi/1", utmSource: "blog" },
      { visitorId: "a", createdAt: now, referrer: null, utmSource: null },
      { visitorId: "b", createdAt: now, referrer: "https://l.threads.net/x", utmSource: null },
      { visitorId: "c", createdAt: now, referrer: "https://l.threads.net/y", utmSource: null },
      { visitorId: "d", createdAt: now, referrer: null, utmSource: null },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.sourceSummary).toEqual([
      { source: "l.threads.net", visitors: 2 },
      { source: "blog", visitors: 1 },
      { source: "직접 유입·알 수 없음", visitors: 1 },
    ]);
    expect(mocks.prisma.siteVisit.findMany.mock.calls[0][0].select).toEqual(
      expect.objectContaining({ referrer: true, utmSource: true }),
    );
  });

  it("로그인 건강: 인앱 브라우저로 들어온 고유 방문자와 로그인 화면 이벤트 건수를 기간 안에서 센다", async () => {
    const now = new Date();
    mocks.prisma.siteVisit.findMany.mockResolvedValue([
      { visitorId: "a", createdAt: now, referrer: null, utmSource: null, inAppBrowser: "kakaotalk" },
      { visitorId: "a", createdAt: now, referrer: null, utmSource: null, inAppBrowser: null },
      { visitorId: "b", createdAt: now, referrer: null, utmSource: null, inAppBrowser: "instagram" },
      { visitorId: "c", createdAt: now, referrer: null, utmSource: null, inAppBrowser: null },
    ]);
    mocks.prisma.clientEvent.groupBy.mockResolvedValue([
      { name: "login_prompt_in_app", _count: { _all: 3 } },
      { name: "google_signin_failed", _count: { _all: 1 } },
    ]);

    const res = createResponse();
    await dashboardHandler({ method: "GET", query: {} }, res);

    expect(res.body.loginHealth).toEqual({
      inAppVisitors: 2,
      events: { login_prompt_in_app: 3, google_button_unavailable: 0, google_signin_failed: 1, kakao_start_failed: 0 },
    });
    expect(mocks.prisma.siteVisit.findMany.mock.calls[0][0].select).toEqual(expect.objectContaining({ inAppBrowser: true }));
    const groupArgs = mocks.prisma.clientEvent.groupBy.mock.calls[0][0];
    expect(groupArgs.by).toEqual(["name"]);
    expect(now.getTime() - groupArgs.where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(7 * DAY - MINUTE);
  });

  it("허용 목록 밖의 days 는 기본 7일로 돌린다", () => {
    expect(readRangeDays({ days: "90" })).toBe(90);
    expect(readRangeDays({ days: "365" })).toBe(7);
    expect(readRangeDays({ days: "abc" })).toBe(7);
    expect(readRangeDays({})).toBe(7);
  });
});
