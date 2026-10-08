import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    mentoringBooking: { count: vi.fn(), findMany: vi.fn() },
    paymentEntitlement: { count: vi.fn(), findMany: vi.fn() },
    analysis: { count: vi.fn(), findMany: vi.fn() },
    purchaseProductSetting: { findMany: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { default: notificationsHandler, readSince } = await import("../../../lib/admin-handlers/notifications.js");
import { createResponse } from "../../helpers/http.js";

const NOW = new Date("2026-09-10T06:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

async function run(query = {}) {
  const res = createResponse();
  await notificationsHandler({ method: "GET", query, headers: {} }, res);
  return res;
}

describe("admin notifications — 알림함", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({});
    mocks.prisma.mentoringBooking.count.mockResolvedValue(0);
    mocks.prisma.mentoringBooking.findMany.mockResolvedValue([]);
    mocks.prisma.paymentEntitlement.count.mockResolvedValue(0);
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([]);
    mocks.prisma.analysis.count.mockResolvedValue(0);
    mocks.prisma.analysis.findMany.mockResolvedValue([]);
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("since 는 없거나 잘못되면 24시간 전, 30일보다 오래되면 30일 전, 미래면 지금", () => {
    expect(readSince({}, NOW).getTime()).toBe(NOW.getTime() - DAY);
    expect(readSince({ since: "not-a-date" }, NOW).getTime()).toBe(NOW.getTime() - DAY);
    expect(readSince({ since: "2020-01-01T00:00:00.000Z" }, NOW).getTime()).toBe(NOW.getTime() - 30 * DAY);
    expect(readSince({ since: "2030-01-01T00:00:00.000Z" }, NOW).getTime()).toBe(NOW.getTime());
    expect(readSince({ since: "2026-09-09T00:00:00.000Z" }, NOW).toISOString()).toBe("2026-09-09T00:00:00.000Z");
  });

  it("관리자가 아니면 401/403 을 그대로 돌려주고 DB 를 읽지 않는다", async () => {
    for (const statusCode of [401, 403]) {
      mocks.requireAdministrator.mockRejectedValueOnce(Object.assign(new Error("nope"), { statusCode }));
      const res = await run();
      expect(res.statusCode).toBe(statusCode);
    }
    expect(mocks.prisma.mentoringBooking.count).not.toHaveBeenCalled();
  });

  it("멘토링은 확정 대기(REQUESTED)만, 결제·실패 분석은 since 이후만 센다", async () => {
    mocks.prisma.mentoringBooking.count.mockResolvedValue(2);
    mocks.prisma.mentoringBooking.findMany.mockResolvedValue([
      { id: "b1", sessionType: "COFFEE_CHAT", createdAt: NOW, slot: { startsAt: new Date("2026-09-12T01:00:00.000Z") } },
    ]);
    mocks.prisma.paymentEntitlement.count.mockResolvedValue(1);
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", createdAt: NOW, rawEvent: { product: "SINGLE" } },
    ]);
    mocks.prisma.analysis.count.mockResolvedValue(1);
    mocks.prisma.analysis.findMany.mockResolvedValue([{ id: "a1", createdAt: NOW, errorCode: "TIMEOUT" }]);

    const res = await run({ since: "2026-09-09T00:00:00.000Z" });

    expect(res.statusCode).toBe(200);
    expect(res.body.mentoringRequested).toEqual({
      count: 2,
      items: [{ id: "b1", sessionType: "COFFEE_CHAT", createdAt: NOW, startsAt: new Date("2026-09-12T01:00:00.000Z") }],
    });
    expect(res.body.payments).toEqual({ count: 1, items: [{ id: "p1", userId: "u1", createdAt: NOW, product: "SINGLE" }] });
    expect(res.body.failedAnalyses).toEqual({ count: 1, items: [{ id: "a1", createdAt: NOW, errorCode: "TIMEOUT" }] });

    expect(mocks.prisma.mentoringBooking.count.mock.calls[0][0].where).toEqual({ status: "REQUESTED" });
    expect(mocks.prisma.paymentEntitlement.count.mock.calls[0][0].where.createdAt.gte.toISOString()).toBe("2026-09-09T00:00:00.000Z");
    expect(mocks.prisma.analysis.count.mock.calls[0][0].where).toEqual(
      expect.objectContaining({ status: "FAILED" }),
    );
  });

  it("응답에 이메일·신청 메시지·결제 원문이 실리지 않는다", async () => {
    mocks.prisma.paymentEntitlement.findMany.mockResolvedValue([
      { id: "p1", userId: "u1", createdAt: NOW, rawEvent: { product: "SINGLE", buyerEmail: "a@b.c" } },
    ]);
    const res = await run();
    expect(JSON.stringify(res.body)).not.toMatch(/@|rawEvent|message/);
    expect(mocks.prisma.mentoringBooking.findMany.mock.calls[0][0].select).not.toHaveProperty("message");
  });
});
