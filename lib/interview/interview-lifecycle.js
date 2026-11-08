// AI 면접 연습 세션의 상태·이용권 규칙. 브라우저가 Gemini 에 직접 붙어 서버는 대화를 볼 수 없으므로,
// 첫 입장권을 내준 순간부터 비용이 시작된다고 보고 이용권을 다룬다.
//
//   CREATED ──첫 입장권──▶ ACTIVE ──끝──▶ ENDED | INTERRUPTED ──피드백 성공──▶ (예약 CONSUMED)
//      │ 10분 안에 입장권 없음·취소           │ 2분 안·답변 2회 미만·환불 한도 남음 ──▶ CANCELLED(환불)
//      └────────────▶ CANCELLED(환불)         └ 모델·서버 장애로 피드백 3회 실패 ──▶ 환불, 대화 글은 보존
//
// 상태를 바꾸는 갱신은 전부 "지금 상태가 X 일 때만" 조건을 단다(updateMany + count). /token 과 /end 가 동시에 와도
// CANCELLED 가 ACTIVE 로 되돌아가지 않는다. 같은 트랜잭션 안에서는 lockInterviewSession 으로 행을 먼저 잠근다.

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
  /** 빨리 끝난 면접을 돌려주는 조건과 계정당 한도. 답변이 하나도 없으면 시간과 무관하게 돌려준다(한도 안에서). */
  earlyEndMs: 2 * 60 * 1000,
  earlyEndMaxCandidateTurns: 2,
  earlyRefundLimit: 2,
  earlyRefundWindowMs: 30 * 24 * 60 * 60 * 1000,
  /** 끝난 뒤 이 시간 안에 피드백을 요청하지 않으면 이용권을 확정한다. 실패한 채 이 시간이 지나면 돌려준다. */
  feedbackClaimWindowMs: 24 * 60 * 60 * 1000,
  /** 피드백 생성 재시도 상한. 모델·서버 장애로 이만큼 실패하면 환불한다. */
  feedbackMaxAttempts: 3,
  /** 접수(PENDING)·호출(CALLING) 상태로 이 시간이 지나면 함수가 죽은 것으로 보고 FAILED 로 돌린다(재시도 가능). */
  feedbackStuckMs: 30 * 60 * 1000,
  /** 동시에 진행할 수 있는 면접 수. */
  concurrencyLimit: 1,
  /** 서비스 전체의 하루 첫 입장권 상한(UTC 기준). 비용 사고를 서버에서 끊는 마지막 선이다. */
  dailyStartCap: 60,
});

export class InterviewConcurrencyLimitError extends Error {
  constructor() {
    super("An interview session is already in progress");
    this.name = "InterviewConcurrencyLimitError";
    this.code = "INTERVIEW_IN_PROGRESS";
  }
}

const OPEN_STATUSES = ["CREATED", "ACTIVE"];

/** 같은 트랜잭션 안에서 세션 행을 잠근다. 메모리 DB(테스트)는 빈 결과를 돌려주고 지나간다. */
export async function lockInterviewSession(tx, sessionId) {
  try {
    await tx.$queryRaw`
      SELECT id
      FROM interview_sessions
      WHERE id = ${sessionId}::uuid
      FOR UPDATE
    `;
  } catch (error) {
    if (error && typeof error === "object") error.safeDiagnosticStage = "interview_session_lock";
    throw error;
  }
}

/** 상태 조건이 맞을 때만 갱신한다. 맞지 않으면(다른 요청이 먼저 바꿈) null. */
async function updateIf(tx, sessionId, where, data) {
  const { count } = await tx.interviewSession.updateMany({ where: { id: sessionId, ...where }, data });
  if (count === 0) return null;
  return tx.interviewSession.findUnique({ where: { id: sessionId } });
}

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

/** UTC 하루의 시작. 전체 상한은 이 시각 이후 첫 입장권을 받은 세션 수로 센다. */
export function dayStartOf(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
  // 답변이 하나도 없으면(연결 실패·시작 직후 장애) 시간이 지났어도 돌려준다. 답변 수는 브라우저 보고라 한도 안에서만.
  if (!early && candidateTurnCount > 0) return "keep";
  return recentEarlyRefunds < INTERVIEW_RULES.earlyRefundLimit ? "refund" : "keep";
}

/** 종료 사유가 정상 종료(사용자 종료·시간 종료)인지. 그 외는 INTERRUPTED 로 남긴다. */
export function endStatusFor(reason) {
  return reason === "user-stop" || reason === "time-up" ? "ENDED" : "INTERRUPTED";
}

async function refundSession(tx, session, { endReason, now, early = false, fromStatuses = OPEN_STATUSES }) {
  const updated = await updateIf(tx, session.id, { status: { in: fromStatuses } }, {
    status: "CANCELLED",
    endedAt: now,
    endReason,
    ...(early ? { earlyRefundAt: now } : {}),
  });
  if (!updated) return null;
  if (session.reservationId) await cancelAnalysisReservation(tx, session.reservationId, session.userId);
  return updated;
}

/**
 * 세션 생성 트랜잭션 하나: 멱등 재생 → 잠금(요약) → 스위치 → 동시성 → 레이트리밋 → 이용권 예약 → 세션 행.
 * 분석 접수(allocateAnalysisRequest)와 같은 순서다.
 */
export async function allocateInterviewSession({
  db,
  userId,
  analysisId,
  direct = null,
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
      if ((existing.analysisId ?? null) !== (analysisId ?? null) || existing.mode !== mode) return { type: "conflict" };
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
        analysisId: analysisId ?? null,
        ...(direct ? { company: direct.company, jobRole: direct.jobRole, coverLetter: direct.coverLetter } : {}),
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
 * 입장권 발급 직전의 세션 상태 갱신. 행을 잠그고 다시 읽은 뒤 판정하므로 동시 요청이 와도 횟수 상한을 넘지 않는다.
 * 첫 발급이면 ACTIVE 로 바꾸고 마감을 정한다. 발급 횟수와 마감을 먼저 올려 두어, 토큰 호출이 실패해도 횟수가 새지 않게 한다(실패 시 호출자가 되돌린다).
 * @returns {{ ok: true, session, expireAt: Date, newSessionExpireAt: Date, first: boolean } | { ok: false, code: string }}
 */
export async function claimTokenIssue(tx, sessionId, now = new Date()) {
  await lockInterviewSession(tx, sessionId);
  const session = await tx.interviewSession.findUnique({ where: { id: sessionId } });
  if (!session) return { ok: false, code: "NOT_FOUND" };
  if (session.status !== "CREATED" && session.status !== "ACTIVE") return { ok: false, code: "INTERVIEW_NOT_OPEN" };
  if (isPastDeadline(session, now)) return { ok: false, code: "INTERVIEW_EXPIRED" };
  if (session.tokenIssueCount >= INTERVIEW_RULES.maxTokenIssues) return { ok: false, code: "INTERVIEW_TOKEN_LIMIT" };

  const first = session.tokenIssueCount === 0;
  if (first) {
    const startedToday = await tx.interviewSession.count({ where: { firstTokenAt: { gte: dayStartOf(now) } } });
    if (startedToday >= INTERVIEW_RULES.dailyStartCap) return { ok: false, code: "INTERVIEW_CAPACITY" };
  }

  const firstTokenAt = session.firstTokenAt ?? now;
  const hardDeadlineAt = session.hardDeadlineAt ?? deadlineFor(session.mode, firstTokenAt);
  const updated = await updateIf(tx, sessionId, { status: session.status }, {
    status: "ACTIVE",
    firstTokenAt,
    hardDeadlineAt,
    tokenIssueCount: { increment: 1 },
  });
  if (!updated) return { ok: false, code: "INTERVIEW_NOT_OPEN" };
  return {
    ok: true,
    first,
    session: updated,
    expireAt: new Date(hardDeadlineAt.getTime() + INTERVIEW_RULES.tokenExpiryAfterDeadlineMs),
    newSessionExpireAt: new Date(now.getTime() + INTERVIEW_RULES.newSessionWindowMs),
  };
}

/**
 * 토큰 호출이 실패했을 때 발급 횟수를 되돌린다. 첫 발급이 실패한 것이면 CREATED 로 되돌려
 * 면접을 한 번도 못 한 세션이 ACTIVE 로 남아 이용권을 쓰는 일을 막는다(재시도는 같은 세션으로 한다).
 */
export async function releaseTokenIssue(db, sessionId) {
  await db.$transaction(async (tx) => {
    await lockInterviewSession(tx, sessionId);
    const session = await tx.interviewSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== "ACTIVE" || session.tokenIssueCount <= 0) return;
    const remaining = session.tokenIssueCount - 1;
    await tx.interviewSession.updateMany({
      where: { id: sessionId, status: "ACTIVE" },
      data: remaining === 0
        ? { tokenIssueCount: 0, status: "CREATED", firstTokenAt: null, hardDeadlineAt: null }
        : { tokenIssueCount: remaining },
    });
  });
}

/**
 * 면접 종료. 행을 잠그고 다시 읽어 환불 여부를 정하고 상태를 바꾼다. 예약은 환불이 아니면 PENDING 으로 남겨 피드백 성공 때 확정한다.
 * @returns {Promise<{ session, refunded: boolean }>}
 */
export async function endInterviewSession(tx, sessionId, { reason, clientReportedUsage = null, now = new Date() }) {
  await lockInterviewSession(tx, sessionId);
  const session = await tx.interviewSession.findUnique({ where: { id: sessionId } });
  if (!session) return { session: null, refunded: false };
  if (!OPEN_STATUSES.includes(session.status)) return { session, refunded: false };

  const candidateTurnCount = await tx.interviewTurn.count({ where: { sessionId: session.id, speaker: "CANDIDATE" } });
  const recentEarlyRefunds = await tx.interviewSession.count({
    where: { userId: session.userId, earlyRefundAt: { gte: new Date(now.getTime() - INTERVIEW_RULES.earlyRefundWindowMs) } },
  });
  const decision = decideEndRefund({ session, candidateTurnCount, recentEarlyRefunds, now });

  if (decision === "refund") {
    const refunded = await refundSession(tx, session, { endReason: reason, now, early: session.status === "ACTIVE" });
    return { session: refunded ?? session, refunded: Boolean(refunded) };
  }
  const updated = await updateIf(tx, session.id, { status: session.status }, {
    status: endStatusFor(reason),
    endedAt: now,
    endReason: reason,
    clientReportedUsage,
  });
  return { session: updated ?? session, refunded: false };
}

/**
 * 묵은 세션 정리. 생성·목록·상세 요청 때는 호출자의 세션만(최대 20건), 일일 크론은 userId 없이 전체(최대 200건)를 훑는다.
 * - CREATED 10분 경과: 취소·환불
 * - ACTIVE 마감 경과: 종료 판정과 같은 규칙(답변 없음·2분 안이면 환불, 아니면 INTERRUPTED)
 * - 끝난 뒤 24시간 피드백 미요청: 예약 확정
 * - 피드백 FAILED 로 24시간 경과(재시도 없음): 환불 — 면접은 했지만 피드백을 못 받은 것은 우리 쪽 책임이다
 * - 피드백 PENDING·CALLING 으로 30분 경과: 함수가 죽은 것이라 FAILED 로 돌린다(재시도 가능, 상한이면 환불)
 * @returns {Promise<number>} 처리한 세션 수
 */
export async function expireStaleInterviewSessions({ db, userId = null, now = new Date(), limit = userId ? 20 : 200 }) {
  if (!db.interviewSession?.findMany) return 0;
  const claimDeadline = new Date(now.getTime() - INTERVIEW_RULES.feedbackClaimWindowMs);
  const candidates = await db.interviewSession.findMany({
    where: {
      ...(userId ? { userId } : {}),
      OR: [
        { status: "CREATED", createdAt: { lte: new Date(now.getTime() - INTERVIEW_RULES.createdTtlMs) } },
        { status: "ACTIVE", hardDeadlineAt: { lte: now } },
        {
          status: { in: ["ENDED", "INTERRUPTED"] },
          feedbackStatus: { in: ["NONE", "FAILED"] },
          endedAt: { lte: claimDeadline },
          reservation: { is: { status: "PENDING" } },
        },
        {
          status: { in: ["ENDED", "INTERRUPTED"] },
          feedbackStatus: { in: ["PENDING", "CALLING"] },
          updatedAt: { lte: new Date(now.getTime() - INTERVIEW_RULES.feedbackStuckMs) },
        },
      ],
    },
    take: limit,
  });

  for (const candidate of candidates) {
    await db.$transaction(async (tx) => {
      // 후보 목록은 트랜잭션 밖에서 읽었다. 잠근 뒤 다시 읽어 그 사이 바뀐 세션(입장권을 받음, 피드백을 요청함)은 건드리지 않는다.
      await lockInterviewSession(tx, candidate.id);
      const session = (await tx.interviewSession.findUnique({ where: { id: candidate.id } })) ?? candidate;
      if (session.status === "CREATED") {
        if (now.getTime() - session.createdAt.getTime() < INTERVIEW_RULES.createdTtlMs) return;
        await refundSession(tx, session, { endReason: "unclaimed", now, fromStatuses: ["CREATED"] });
      } else if (session.status === "ACTIVE") {
        if (!isPastDeadline(session, now)) return;
        await endInterviewSession(tx, session.id, { reason: "deadline", now });
      } else if (["PENDING", "CALLING"].includes(session.feedbackStatus)) {
        if (session.updatedAt && now.getTime() - session.updatedAt.getTime() < INTERVIEW_RULES.feedbackStuckMs) return;
        const attempts = (session.feedbackAttempts ?? 0) + 1;
        const { count } = await tx.interviewSession.updateMany({
          where: { id: session.id, feedbackStatus: { in: ["PENDING", "CALLING"] } },
          data: { feedbackStatus: "FAILED", feedbackAttempts: attempts, feedbackJson: { failure: "error" } },
        });
        if (count > 0 && attempts >= INTERVIEW_RULES.feedbackMaxAttempts && session.reservationId) {
          await cancelAnalysisReservation(tx, session.reservationId, session.userId);
        }
      } else if (["NONE", "FAILED"].includes(session.feedbackStatus)) {
        if (!session.endedAt || session.endedAt.getTime() > claimDeadline.getTime() || !session.reservationId) return;
        // FAILED 는 마지막 실패가 장애(error)였을 때만 돌려준다. 금지 표현만 돌아온 실패(unusable)는 확정한다 — 대화 글로 환불을 유도하는 길을 24시간 뒤에도 열어 주지 않는다.
        if (session.feedbackStatus === "FAILED" && lastFeedbackFailure(session) === "error") {
          await cancelAnalysisReservation(tx, session.reservationId, session.userId);
        } else {
          await finalizeAnalysisReservation(tx, session.reservationId, session.userId);
        }
      }
    });
  }
  return candidates.length;
}

/** 실패한 피드백의 마지막 실패 종류. feedback_json 에 { failure: "error" | "unusable" } 로 남긴다(성공하면 덮어씀, 화면에는 안 내려감). */
export function lastFeedbackFailure(session) {
  const json = session.feedbackJson;
  return json && typeof json === "object" && typeof json.failure === "string" ? json.failure : null;
}
