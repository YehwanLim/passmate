import { describe, expect, it } from "vitest";

import { INTERVIEW_RULES, deadlineFor, decideEndRefund, endStatusFor, isPastDeadline } from "./interview-lifecycle.js";

const T0 = new Date("2026-11-04T10:00:00Z");
const minutes = (count) => new Date(T0.getTime() + count * 60_000);

describe("면접 세션 규칙", () => {
  it("마감은 모드별 길이에 1분 여유를 더한다", () => {
    expect(deadlineFor("FULL", T0)).toEqual(minutes(16));
    expect(deadlineFor("SHORT", T0)).toEqual(minutes(6));
    expect(deadlineFor("UNKNOWN", T0)).toEqual(minutes(16));
  });

  it("입장권을 받지 않은 세션은 10분, 받은 세션은 마감 시각으로 끝났는지 본다", () => {
    const created = { status: "CREATED", createdAt: T0 };
    expect(isPastDeadline(created, minutes(9))).toBe(false);
    expect(isPastDeadline(created, minutes(10))).toBe(true);
    const active = { status: "ACTIVE", hardDeadlineAt: minutes(16) };
    expect(isPastDeadline(active, minutes(15))).toBe(false);
    expect(isPastDeadline(active, minutes(16))).toBe(true);
    expect(isPastDeadline({ status: "ENDED" }, minutes(99))).toBe(false);
  });

  it("입장권을 받기 전에 끝내면 돌려준다", () => {
    expect(decideEndRefund({ session: { status: "CREATED" }, candidateTurnCount: 0, recentEarlyRefunds: 5, now: T0 })).toBe("refund");
  });

  it("2분 안에 답변 2회 미만으로 끝나면 돌려주되, 30일 2회까지만", () => {
    const session = { status: "ACTIVE", firstTokenAt: T0 };
    expect(decideEndRefund({ session, candidateTurnCount: 1, recentEarlyRefunds: 0, now: minutes(1) })).toBe("refund");
    expect(decideEndRefund({ session, candidateTurnCount: 1, recentEarlyRefunds: INTERVIEW_RULES.earlyRefundLimit, now: minutes(1) })).toBe("keep");
  });

  it("2분을 넘기거나 답변을 2회 이상 했으면 사용한 것으로 본다", () => {
    const session = { status: "ACTIVE", firstTokenAt: T0 };
    expect(decideEndRefund({ session, candidateTurnCount: 0, recentEarlyRefunds: 0, now: minutes(2) })).toBe("keep");
    expect(decideEndRefund({ session, candidateTurnCount: 2, recentEarlyRefunds: 0, now: minutes(1) })).toBe("keep");
  });

  it("사용자 종료·시간 종료만 정상 종료, 나머지는 중단으로 남긴다", () => {
    expect(endStatusFor("user-stop")).toBe("ENDED");
    expect(endStatusFor("time-up")).toBe("ENDED");
    expect(endStatusFor("closed")).toBe("INTERRUPTED");
    expect(endStatusFor("reconnect-failed")).toBe("INTERRUPTED");
  });
});
