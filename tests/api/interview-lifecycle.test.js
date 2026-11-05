import { describe, expect, it, vi } from "vitest";

import { INTERVIEW_RULES, expireStaleInterviewSessions } from "../../lib/interview/interview-lifecycle.js";

const NOW = new Date("2026-11-05T03:00:00.000Z");
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000);

function fakeDb(sessions) {
  const updates = [];
  const reservationUpdates = [];
  const db = {
    interviewSession: {
      findMany: vi.fn(async ({ where, take }) => {
        const scoped = where.userId ? sessions.filter((session) => session.userId === where.userId) : sessions;
        return scoped.slice(0, take);
      }),
      update: vi.fn(async ({ where, data }) => {
        updates.push({ id: where.id, ...data });
        return { id: where.id, ...data };
      }),
    },
    analysisReservation: {
      updateMany: vi.fn(async ({ where, data }) => {
        reservationUpdates.push({ ...where, ...data });
        return { count: 1 };
      }),
      findFirst: vi.fn(async () => null),
    },
    $transaction: async (run) => run(db),
  };
  return { db, updates, reservationUpdates };
}

describe("묵은 면접 세션 정리", () => {
  const created = { id: "s-created", userId: "u1", status: "CREATED", reservationId: "r1", createdAt: minutesAgo(11) };
  const active = { id: "s-active", userId: "u2", status: "ACTIVE", reservationId: "r2", hardDeadlineAt: minutesAgo(1) };

  it("userId 없이 부르면(일일 크론) 모든 사용자의 세션을 최대 200건 훑고 처리 수를 돌려준다", async () => {
    const { db, updates, reservationUpdates } = fakeDb([created, active]);

    await expect(expireStaleInterviewSessions({ db, now: NOW })).resolves.toBe(2);

    expect(db.interviewSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    expect(db.interviewSession.findMany.mock.calls[0][0].where).not.toHaveProperty("userId");
    expect(updates).toContainEqual(expect.objectContaining({ id: "s-created", status: "CANCELLED", endReason: "unclaimed" }));
    expect(updates).toContainEqual(expect.objectContaining({ id: "s-active", status: "INTERRUPTED", endReason: "deadline" }));
    // 입장권을 못 받은 세션만 환불된다.
    expect(reservationUpdates).toEqual([expect.objectContaining({ id: "r1", status: "CANCELLED" })]);
  });

  it("userId 를 주면(사용자 요청) 그 사용자의 세션만 최대 20건 훑는다", async () => {
    const { db } = fakeDb([created, active]);

    await expect(expireStaleInterviewSessions({ db, userId: "u1", now: NOW })).resolves.toBe(1);

    expect(db.interviewSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20, where: expect.objectContaining({ userId: "u1" }) }));
  });

  it("세션 표가 없는 DB(옛 테스트 목)에서는 아무것도 하지 않는다", async () => {
    await expect(expireStaleInterviewSessions({ db: {}, now: NOW })).resolves.toBe(0);
    expect(INTERVIEW_RULES.createdTtlMs).toBe(10 * 60 * 1000);
  });
});
