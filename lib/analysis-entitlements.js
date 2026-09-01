const FREE_CREDITS_PER_ACCOUNT = 1;
const CREDIT_RESERVATION_STATUSES = ["PENDING", "CONSUMED"];

export class EntitlementUnavailableError extends Error {
  constructor() {
    super("Analysis credits are exhausted");
    this.code = "ANALYSIS_CREDITS_EXHAUSTED";
  }
}

async function getLockedEntitlement(tx, userId) {
  await tx.analysisEntitlement.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  try {
    await tx.$queryRaw`
      SELECT id
      FROM analysis_entitlements
      WHERE user_id = ${userId}::uuid
      FOR UPDATE
    `;
  } catch (error) {
    if (error && typeof error === "object") error.safeDiagnosticStage = "analysis_entitlement_lock";
    throw error;
  }

  return tx.analysisEntitlement.findUnique({ where: { userId } });
}

async function getUsage(tx, userId, source) {
  return tx.analysisReservation.count({
    where: {
      userId,
      source,
      status: { in: CREDIT_RESERVATION_STATUSES },
    },
  });
}

async function getSummaryForEntitlement(tx, userId, entitlement) {
  const freeUsed = await getUsage(tx, userId, "FREE");
  const freeRemaining = Math.max(FREE_CREDITS_PER_ACCOUNT - freeUsed, 0);
  // 보너스(관리자 지급) 크레딧은 판매 스위치와 무관하게 사용할 수 있다 —
  // 베타 테스터·제휴 지급이 결제 오픈 여부에 묶이지 않아야 하기 때문.
  const bonusUsed = await getUsage(tx, userId, "BONUS");
  const bonusRemaining = Math.max(
    Number(entitlement?.bonusCreditsGranted ?? 0) - bonusUsed,
    0,
  );
  const settings = await tx.entitlementSetting.findUnique({
    where: { id: "singleton" },
    select: { premiumEnabled: true },
  });
  const premiumEnabled = settings?.premiumEnabled === true;
  const premiumUsed = premiumEnabled ? await getUsage(tx, userId, "PREMIUM") : 0;
  const premiumRemaining = premiumEnabled
    ? Math.max(Number(entitlement?.premiumCreditsGranted ?? 0) - premiumUsed, 0)
    : 0;

  return {
    premiumEnabled,
    freeRemaining,
    bonusRemaining,
    premiumRemaining,
    remaining: freeRemaining + bonusRemaining + premiumRemaining,
  };
}

/**
 * 피드백 보상을 이미 받은 계정인지. 리포트 하단 안내가 이미 받은 사람에게
 * "1회 더 드려요"를 계속 띄우지 않도록 쓴다.
 *
 * 요약(getEntitlementSummary)에 넣지 않는 이유: 그 함수는 분석 예약마다 불려서,
 * 화면 문구 하나 때문에 분석 경로에 쿼리를 하나 더 얹게 된다.
 */
export async function hasClaimedFeedbackReward(tx, userId) {
  return (await tx.feedbackCreditGrant.count({ where: { userId } })) > 0;
}

export async function getEntitlementSummary(tx, userId) {
  const entitlement = await getLockedEntitlement(tx, userId);
  return getSummaryForEntitlement(tx, userId, entitlement);
}

export async function reserveAnalysis(tx, userId) {
  const entitlement = await getLockedEntitlement(tx, userId);
  const summary = await getSummaryForEntitlement(tx, userId, entitlement);

  if (summary.remaining === 0) {
    throw new EntitlementUnavailableError();
  }

  const source = summary.freeRemaining > 0
    ? "FREE"
    : summary.bonusRemaining > 0
      ? "BONUS"
      : "PREMIUM";
  const reservation = await tx.analysisReservation.create({
    data: {
      userId,
      source,
      status: "PENDING",
    },
  });

  return {
    reservationId: reservation.id,
    source: source.toLowerCase(),
  };
}

export async function finalizeAnalysisReservation(tx, reservationId, userId) {
  await tx.analysisReservation.updateMany({
    where: {
      id: reservationId,
      userId,
      status: "PENDING",
    },
    data: {
      status: "CONSUMED",
      finalizedAt: new Date(),
    },
  });
}

export async function cancelAnalysisReservation(tx, reservationId, userId) {
  await tx.analysisReservation.updateMany({
    where: {
      id: reservationId,
      userId,
      status: "PENDING",
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });
}

export async function grantGroblePurchase(tx, input) {
  const entitlement = await getLockedEntitlement(tx, input.userId);
  const settings = await tx.entitlementSetting.findUnique({ where: { id: "singleton" } });
  const credits = settings?.premiumCreditsPerPurchase ?? 3;

  const insertedPayment = await tx.$queryRaw`
    INSERT INTO payment_entitlements (
      user_id,
      provider_payment_id,
      credits_granted,
      raw_event
    )
    VALUES (
      ${input.userId}::uuid,
      ${input.providerPaymentId},
      ${credits},
      ${JSON.stringify(input.rawEvent ?? null)}::jsonb
    )
    ON CONFLICT (provider_payment_id) DO NOTHING
    RETURNING id
  `;

  if (insertedPayment.length === 0) {
    return { granted: false, credits: 0 };
  }

  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: {
      premiumCreditsGranted: { increment: credits },
    },
  });

  return { granted: true, credits };
}

export function assertCreditAmount(credits) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 10000) {
    const error = new Error("Credits must be an integer between 1 and 10,000");
    error.code = "INVALID_CREDIT_AMOUNT";
    throw error;
  }
}

/** 설문을 완주한 계정에 지급하는 크레딧 수. */
export const FEEDBACK_REWARD_CREDITS = 1;

/**
 * 피드백 보상 크레딧을 계정당 한 번만 지급한다.
 *
 * 엔타이틀먼트 잠금을 먼저 잡고 이력을 확인한다 — 확인이 먼저면 동시 요청 두 건이
 * 모두 "아직 안 받음"을 보고 통과해, 뒤늦게 유니크 위반으로 트랜잭션 전체(피드백
 * 저장 포함)가 롤백된다. 이미 받은 계정이면 지급 없이 false 를 돌려준다.
 */
export async function grantFeedbackCredit(tx, {
  userId,
  feedbackId = null,
  credits = FEEDBACK_REWARD_CREDITS,
}) {
  assertCreditAmount(credits);
  const entitlement = await getLockedEntitlement(tx, userId);

  const existing = await tx.feedbackCreditGrant.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return false;

  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: { bonusCreditsGranted: { increment: credits } },
  });
  await tx.feedbackCreditGrant.create({
    data: { userId, feedbackId, creditsGranted: credits },
  });
  return true;
}

export async function grantAdminCredits(tx, {
  userId,
  credits,
  grantedByUserId,
  grantedByEmail,
  note = null,
}) {
  assertCreditAmount(credits);
  const entitlement = await getLockedEntitlement(tx, userId);
  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: { bonusCreditsGranted: { increment: credits } },
  });
  await tx.adminCreditGrant.create({
    data: {
      userId,
      grantedByUserId,
      grantedByEmail,
      creditsGranted: credits,
      source: "MANUAL",
      note,
    },
  });
  return getEntitlementSummary(tx, userId);
}
