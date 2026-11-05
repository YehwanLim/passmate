import { describe, expect, it, vi } from "vitest";

import { INTERVIEW_RULES, decideEndRefund, expireStaleInterviewSessions } from "../../lib/interview/interview-lifecycle.js";

const NOW = new Date("2026-11-05T03:00:00.000Z");
const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60 * 1000);
const hoursAgo = (hours) => minutesAgo(hours * 60);

function matchesStatus(row, cond) {
  if (cond === undefined) return true;
  if (cond && typeof cond === "object" && "in" in cond) return cond.in.includes(row);
  return row === cond;
}

/** 정리 작업이 쓰는 조회·갱신만 흉내 낸다. 세션 행은 제자리에서 바뀐다. */
function fakeDb(sessions, { candidateTurns = {} } = {}) {
  const reservationUpdates = [];
  const db = {
    $queryRaw: vi.fn(async () => []),
    interviewSession: {
      findMany: vi.fn(async ({ where, take }) => {
        const scoped = where.userId ? sessions.filter((session) => session.userId === where.userId) : sessions;
        return scoped.slice(0, take);
      }),
      findUnique: vi.fn(async ({ where }) => sessions.find((session) => session.id === where.id) ?? null),
      count: vi.fn(async () => 0),
      updateMany: vi.fn(async ({ where, data }) => {
        const rows = sessions.filter((session) => session.id === where.id && matchesStatus(session.status, where.status) && matchesStatus(session.feedbackStatus, where.feedbackStatus));
        for (const row of rows) {
          for (const [key, value] of Object.entries(data)) {
            row[key] = value && typeof value === "object" && "increment" in value ? (row[key] ?? 0) + value.increment : value;
          }
        }
        return { count: rows.length };
      }),
    },
    interviewTurn: {
      count: vi.fn(async ({ where }) => candidateTurns[where.sessionId] ?? 0),
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
  return { db, reservationUpdates };
}

describe("종료 시점 이용권 판정", () => {
  const session = { status: "ACTIVE", firstTokenAt: minutesAgo(10) };
  it("답변이 하나도 없으면 시간이 지났어도 한도 안에서 돌려주고, 답변이 있으면 2분·2회 규칙을 따른다", () => {
    expect(decideEndRefund({ session, candidateTurnCount: 0, recentEarlyRefunds: 0, now: NOW })).toBe("refund");
    expect(decideEndRefund({ session, candidateTurnCount: 0, recentEarlyRefunds: INTERVIEW_RULES.earlyRefundLimit, now: NOW })).toBe("keep");
    expect(decideEndRefund({ session, candidateTurnCount: 1, recentEarlyRefunds: 0, now: NOW })).toBe("keep");
    expect(decideEndRefund({ session: { status: "ACTIVE", firstTokenAt: minutesAgo(1) }, candidateTurnCount: 1, recentEarlyRefunds: 0, now: NOW })).toBe("refund");
    expect(decideEndRefund({ session: { status: "ACTIVE", firstTokenAt: minutesAgo(1) }, candidateTurnCount: 2, recentEarlyRefunds: 0, now: NOW })).toBe("keep");
    expect(decideEndRefund({ session: { status: "CREATED" }, candidateTurnCount: 0, recentEarlyRefunds: 9, now: NOW })).toBe("refund");
  });
});

describe("묵은 면접 세션 정리", () => {
  const created = () => ({ id: "s-created", userId: "u1", status: "CREATED", reservationId: "r1", createdAt: minutesAgo(11) });
  const active = () => ({ id: "s-active", userId: "u2", status: "ACTIVE", reservationId: "r2", firstTokenAt: minutesAgo(17), hardDeadlineAt: minutesAgo(1) });

  it("userId 없이 부르면(일일 크론) 모든 사용자의 세션을 최대 200건 훑고 처리 수를 돌려준다", async () => {
    const rows = [created(), active()];
    const { db, reservationUpdates } = fakeDb(rows, { candidateTurns: { "s-active": 3 } });

    await expect(expireStaleInterviewSessions({ db, now: NOW })).resolves.toBe(2);

    expect(db.interviewSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    expect(db.interviewSession.findMany.mock.calls[0][0].where).not.toHaveProperty("userId");
    expect(rows[0]).toMatchObject({ status: "CANCELLED", endReason: "unclaimed" });
    expect(rows[1]).toMatchObject({ status: "INTERRUPTED", endReason: "deadline" });
    // 입장권을 못 받은 세션만 환불된다. 답변이 있는 ACTIVE 는 사용한 것으로 남는다.
    expect(reservationUpdates).toEqual([expect.objectContaining({ id: "r1", status: "CANCELLED" })]);
  });

  it("마감이 지난 ACTIVE 도 답변이 없으면 종료와 같은 규칙으로 돌려준다", async () => {
    const rows = [active()];
    const { db, reservationUpdates } = fakeDb(rows);
    await expireStaleInterviewSessions({ db, now: NOW });
    expect(rows[0]).toMatchObject({ status: "CANCELLED", endReason: "deadline", earlyRefundAt: NOW });
    expect(reservationUpdates).toEqual([expect.objectContaining({ id: "r2", status: "CANCELLED" })]);
  });

  it("접수·호출 상태로 30분이 지나면 FAILED 로 돌리고(재시도 가능), 상한이면 돌려준다", async () => {
    const stuck = { id: "s-stuck", userId: "u3", status: "ENDED", reservationId: "r3", feedbackStatus: "CALLING", feedbackAttempts: 0, endedAt: hoursAgo(1), updatedAt: minutesAgo(31) };
    const lastTry = { id: "s-last", userId: "u4", status: "ENDED", reservationId: "r4", feedbackStatus: "PENDING", feedbackAttempts: INTERVIEW_RULES.feedbackMaxAttempts - 1, endedAt: hoursAgo(1), updatedAt: minutesAgo(31) };
    const { db, reservationUpdates } = fakeDb([stuck, lastTry]);
    await expireStaleInterviewSessions({ db, now: NOW });
    expect(stuck).toMatchObject({ feedbackStatus: "FAILED", feedbackAttempts: 1 });
    expect(lastTry).toMatchObject({ feedbackStatus: "FAILED", feedbackAttempts: INTERVIEW_RULES.feedbackMaxAttempts });
    expect(reservationUpdates).toEqual([expect.objectContaining({ id: "r4", status: "CANCELLED" })]);
  });

  it("끝난 뒤 24시간: 피드백을 안 받았으면 확정하고, 실패한 채였으면 돌려준다", async () => {
    const unclaimed = { id: "s-none", userId: "u5", status: "ENDED", reservationId: "r5", feedbackStatus: "NONE", endedAt: hoursAgo(25) };
    const failed = { id: "s-failed", userId: "u6", status: "INTERRUPTED", reservationId: "r6", feedbackStatus: "FAILED", feedbackAttempts: 1, endedAt: hoursAgo(25) };
    const { db, reservationUpdates } = fakeDb([unclaimed, failed]);
    await expireStaleInterviewSessions({ db, now: NOW });
    expect(reservationUpdates).toEqual([
      expect.objectContaining({ id: "r5", status: "CONSUMED" }),
      expect.objectContaining({ id: "r6", status: "CANCELLED" }),
    ]);
  });

  it("userId 를 주면(사용자 요청) 그 사용자의 세션만 최대 20건 훑는다", async () => {
    const { db } = fakeDb([created(), active()]);

    await expect(expireStaleInterviewSessions({ db, userId: "u1", now: NOW })).resolves.toBe(1);

    expect(db.interviewSession.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20, where: expect.objectContaining({ userId: "u1" }) }));
  });

  it("세션 표가 없는 DB(옛 테스트 목)에서는 아무것도 하지 않는다", async () => {
    await expect(expireStaleInterviewSessions({ db: {}, now: NOW })).resolves.toBe(0);
    expect(INTERVIEW_RULES.createdTtlMs).toBe(10 * 60 * 1000);
  });
});
