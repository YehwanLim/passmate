// AI 면접 연습 세션의 상태·이용권 규칙. 브라우저가 Gemini 에 직접 붙어 서버는 대화를 볼 수 없으므로,
// 첫 입장권을 내준 순간부터 비용이 시작된다고 보고 이용권을 다룬다.
//
//   CREATED ──첫 입장권──▶ ACTIVE ──끝──▶ ENDED | INTERRUPTED ──피드백 성공──▶ (예약 CONSUMED)
//      │ 10분 안에 입장권 없음·취소           │ 2분 안·답변 2회 미만·환불 한도 남음 ──▶ CANCELLED(환불)
//      └────────────▶ CANCELLED(환불)         └ 피드백 3회 실패 ──▶ 환불, 대화 글은 보존

import { cancelAnalysisReservation, finalizeAnalysisReservation } from "../billing/analysis-entitlements.js";

export const INTERVIEW_RULES = Object.freeze({
  /** 세션을 만든 뒤 이 시간 안에 입장권을 안 받으면 취소·환불한다. */
  createdTtlMs: 10 * 60 * 1000,
  /** 면접 길이(모드별)와 서버 기준 마감까지의 여유. */
  durationMs: Object.freeze({ FULL: 15 * 60 * 1000, SHORT: 5 * 60 * 1000 }),
  deadlineGraceMs: 60 * 1000,
  /** 입장권 만료는 마감 뒤 1분. 서버가 강제할 수 있는 유일한 비용 상한이다. */
  tokenExpiryAfterDeadlineMs: 60 * 1000,
  /** 새 세션을 시작할 수 있는 시간(입장권을 받은 뒤). */
  newSessionWindowMs: 2 * 60 * 1000,
  /** 첫 발급 + 재연결용 재발급 상한. */
  maxTokenIssues: 5,
  /** 빨리 끝난 면접을 돌려주는 조건과 계정당 한도. */
  earlyEndMs: 2 * 60 * 1000,
  earlyEndMaxCandidateTurns: 2,
  earlyRefundLimit: 2,
  earlyRefundWindowMs: 30 * 24 * 60 * 60 * 1000,
  /** 끝난 뒤 이 시간 안에 피드백을 요청하지 않으면 이용권을 확정한다. */
  feedbackClaimWindowMs: 24 * 60 * 60 * 1000,
  /** 피드백 생성 재시도 상한. 넘으면 환불한다. */
  feedbackMaxAttempts: 3,
  /** 동시에 진행할 수 있는 면접 수. */
  concurrencyLimit: 1,
});

export class InterviewConcurrencyLimitError extends Error {
  constructor() {
    super("An interview session is already in progress");
    this.name = "InterviewConcurrencyLimitError";
    this.code = "INTERVIEW_IN_PROGRESS";
  }
}

const OPEN_STATUSES = ["CREATED", "ACTIVE"];

export function deadlineFor(mode, firstTokenAt) {
  const duration = INTERVIEW_RULES.durationMs[mode] ?? INTERVIEW_RULES.durationMs.FULL;
  return new Date(firstTokenAt.getTime() + duration + INTERVIEW_RULES.deadlineGraceMs);
}

/** 서버가 끝난 것으로 보는 시각. 입장권을 받지 않은 세션은 생성 뒤 TTL 로 판단한다. */
export function isPastDeadline(session, now) {
  if (session.status === "CREATED") return now.getTime() - session.createdAt.getTime() >= INTERVIEW_RULES.createdTtlMs;
  if (session.status === "ACTIVE") return Boolean(session.hardDeadlineAt) && now.getTime() >= session.hardDeadlineAt.getTime();
  return false;
}

/**
 * 종료 시점의 이용권 판정. 순수 함수라 테스트하기 쉽다.
 * @returns {"refund" | "keep"} refund 면 예약을 취소한다(돌려줌).
 */
export function decideEndRefund({ session, candidateTurnCount, recentEarlyRefunds, now }) {
  if (session.status === "CREATED") return "refund";
  if (!session.firstTokenAt) return "refund";
  const elapsed = now.getTime() - session.firstTokenAt.getTime();
  const early = elapsed < INTERVIEW_RULES.earlyEndMs && candidateTurnCount < INTERVIEW_RULES.earlyEndMaxCandidateTurns;
  if (!early) return "keep";
  return recentEarlyRefunds < INTERVIEW_RULES.earlyRefundLimit ? "refund" : "keep";
}

/** 종료 사유가 정상 종료(사용자 종료·시간 종료)인지. 그 외는 INTERRUPTED 로 남긴다. */
export function endStatusFor(reason) {
  return reason === "user-stop" || reason === "time-up" ? "ENDED" : "INTERRUPTED";
}

async function refundSession(tx, session, { endReason, now, early = false }) {
  if (session.reservationId) await cancelAnalysisReservation(tx, session.reservationId, session.userId);
  return tx.interviewSession.update({
    where: { id: session.id },
    data: {
      status: "CANCELLED",
      endedAt: now,
      endReason,
      ...(early ? { earlyRefundAt: now } : {}),
    },
  });
}

/**
 * 세션 생성 트랜잭션 하나: 멱등 재생 → 잠금(요약) → 스위치 → 동시성 → 레이트리밋 → 이용권 예약 → 세션 행.
 * 분석 접수(allocateAnalysisRequest)와 같은 순서다.
 */
export async function allocateInterviewSession({
  db,
  userId,
  analysisId,
  idempotencyKey,
  mode,
  consentVersion,
  liveModel,
  promptVersion,
  getSummary,
  reserve,
  consumeRateLimit,
  policy,
  now = new Date(),
}) {
  return db.$transaction(async (tx) => {
    const existing = await tx.interviewSession.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (existing) {
      if (existing.analysisId !== analysisId || existing.mode !== mode) return { type: "conflict" };
      return { type: "stored", session: existing };
    }

    const summary = await getSummary(tx, userId);
    if (!summary.interviewEnabled) return { type: "disabled" };
    if (summary.interviewRemaining === 0) return { type: "exhausted" };

    const open = await tx.interviewSession.findMany({
      where: { userId, status: { in: OPEN_STATUSES } },
      select: { id: true, status: true, createdAt: true, hardDeadlineAt: true, reservationId: true, userId: true },
    });
    const live = open.filter((session) => !isPastDeadline(session, now));
    if (live.length >= INTERVIEW_RULES.concurrencyLimit) throw new InterviewConcurrencyLimitError();

    const rate = await consumeRateLimit(tx, { userId, policy, now });
    if (!rate.allowed) return { type: "rate_limited", rate };

    const reservation = await reserve(tx, userId, "INTERVIEW");
    const session = await tx.interviewSession.create({
      data: {
        userId,
        analysisId,
        reservationId: reservation.reservationId,
        idempotencyKey,
        mode,
        status: "CREATED",
        liveModel,
        promptVersion,
        consentVersion,
        consentedAt: now,
      },
    });
    return { type: "created", session };
  });
}

/**
 * 입장권 발급 직전의 세션 상태 갱신. 첫 발급이면 ACTIVE 로 바꾸고 마감을 정한다.
 * 발급 횟수와 마감을 먼저 올려 두어, 토큰 호출이 실패해도 횟수가 새지 않게 한다(실패 시 호출자가 되돌린다).
 * @returns {{ ok: true, session, expireAt: Date } | { ok: false, code: string }}
 */
export async function claimTokenIssue(tx, session, now = new Date()) {
  if (session.status !== "CREATED" && session.status !== "ACTIVE") return { ok: false, code: "INTERVIEW_NOT_OPEN" };
  if (isPastDeadline(session, now)) return { ok: false, code: "INTERVIEW_EXPIRED" };
  if (session.tokenIssueCount >= INTERVIEW_RULES.maxTokenIssues) return { ok: false, code: "INTERVIEW_TOKEN_LIMIT" };

  const firstTokenAt = session.firstTokenAt ?? now;
  const hardDeadlineAt = session.hardDeadlineAt ?? deadlineFor(session.mode, firstTokenAt);
  const updated = await tx.interviewSession.update({
    where: { id: session.id },
    data: {
      status: "ACTIVE",
      firstTokenAt,
      hardDeadlineAt,
      tokenIssueCount: { increment: 1 },
    },
  });
  return {
    ok: true,
    session: updated,
    expireAt: new Date(hardDeadlineAt.getTime() + INTERVIEW_RULES.tokenExpiryAfterDeadlineMs),
    newSessionExpireAt: new Date(now.getTime() + INTERVIEW_RULES.newSessionWindowMs),
  };
}

/** 토큰 호출이 실패했을 때 발급 횟수만 되돌린다. 상태(ACTIVE)는 그대로 둔다 — 비용은 아직 안 났지만 재시도는 같은 세션으로 한다. */
export async function releaseTokenIssue(tx, sessionId) {
  await tx.interviewSession.update({ where: { id: sessionId }, data: { tokenIssueCount: { decrement: 1 } } });
}

/**
 * 면접 종료. 환불 여부를 정하고 상태를 바꾼다. 예약은 환불이 아니면 PENDING 으로 남겨 피드백 성공 때 확정한다.
 * @returns {Promise<{ session, refunded: boolean }>}
 */
export async function endInterviewSession(tx, session, { reason, clientReportedUsage = null, now = new Date() }) {
  if (!OPEN_STATUSES.includes(session.status)) return { session, refunded: false };

  const candidateTurnCount = await tx.interviewTurn.count({ where: { sessionId: session.id, speaker: "CANDIDATE" } });
  const recentEarlyRefunds = await tx.interviewSession.count({
    where: { userId: session.userId, earlyRefundAt: { gte: new Date(now.getTime() - INTERVIEW_RULES.earlyRefundWindowMs) } },
  });
  const decision = decideEndRefund({ session, candidateTurnCount, recentEarlyRefunds, now });

  if (decision === "refund") {
    const refunded = await refundSession(tx, session, { endReason: reason, now, early: session.status === "ACTIVE" });
    return { session: refunded, refunded: true };
  }
  const updated = await tx.interviewSession.update({
    where: { id: session.id },
    data: { status: endStatusFor(reason), endedAt: now, endReason: reason, clientReportedUsage },
  });
  return { session: updated, refunded: false };
}

/**
 * 묵은 세션 정리. 생성·목록·상세 요청 때 호출자의 세션만 훑는다(최대 20건).
 * - CREATED 10분 경과: 취소·환불
 * - ACTIVE 마감 경과: INTERRUPTED(이용권 유지, 브라우저가 끝을 알리지 못한 경우)
 * - 끝난 뒤 24시간 피드백 미요청: 예약 확정
 */
export async function expireStaleInterviewSessions({ db, userId, now = new Date() }) {
  if (!db.interviewSession?.findMany) return;
  const candidates = await db.interviewSession.findMany({
    where: {
      userId,
      OR: [
        { status: "CREATED", createdAt: { lte: new Date(now.getTime() - INTERVIEW_RULES.createdTtlMs) } },
        { status: "ACTIVE", hardDeadlineAt: { lte: now } },
        {
          status: { in: ["ENDED", "INTERRUPTED"] },
          feedbackStatus: "NONE",
          endedAt: { lte: new Date(now.getTime() - INTERVIEW_RULES.feedbackClaimWindowMs) },
          reservation: { is: { status: "PENDING" } },
        },
      ],
    },
    take: 20,
  });

  for (const session of candidates) {
    await db.$transaction(async (tx) => {
      if (session.status === "CREATED") {
        await refundSession(tx, session, { endReason: "unclaimed", now });
      } else if (session.status === "ACTIVE") {
        await tx.interviewSession.update({
          where: { id: session.id },
          data: { status: "INTERRUPTED", endedAt: now, endReason: "deadline" },
        });
      } else if (session.reservationId) {
        await finalizeAnalysisReservation(tx, session.reservationId, session.userId);
      }
    });
  }
}
