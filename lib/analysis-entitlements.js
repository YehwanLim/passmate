const SETTINGS_ID = "singleton";
const FREE_CREDITS_PER_ACCOUNT = 1;
const CREDIT_RESERVATION_STATUSES = ["PENDING", "CONSUMED"];

export class EntitlementUnavailableError extends Error {
  constructor() {
    super("Analysis credits are exhausted");
    this.code = "ANALYSIS_CREDITS_EXHAUSTED";
  }
}

export class CreditCouponError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function getLockedEntitlement(tx, userId) {
  await tx.analysisEntitlement.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  await tx.$queryRaw`
    SELECT id
    FROM analysis_entitlements
    WHERE user_id = ${userId}::uuid
    FOR UPDATE
  `;

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
  const [settings, freeUsed, bonusUsed, premiumUsed] = await Promise.all([
    tx.entitlementSetting.findUnique({ where: { id: SETTINGS_ID } }),
    getUsage(tx, userId, "FREE"),
    getUsage(tx, userId, "BONUS"),
    getUsage(tx, userId, "PREMIUM"),
  ]);
  const freeRemaining = Math.max(FREE_CREDITS_PER_ACCOUNT - freeUsed, 0);
  const bonusRemaining = Math.max(entitlement.bonusCreditsGranted - bonusUsed, 0);
  const premiumRemaining = Math.max(entitlement.premiumCreditsGranted - premiumUsed, 0);

  return {
    premiumEnabled: settings?.premiumEnabled ?? false,
    freeRemaining,
    bonusRemaining,
    premiumRemaining,
    remaining: freeRemaining + bonusRemaining + premiumRemaining,
  };
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

function assertCreditAmount(credits) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 10000) {
    const error = new Error("Credits must be an integer between 1 and 10,000");
    error.code = "INVALID_CREDIT_AMOUNT";
    throw error;
  }
}

export async function getEntitlementSummaries(tx, userIds) {
  if (userIds.length === 0) return [];

  const [settings, entitlements, usage] = await Promise.all([
    tx.entitlementSetting.findUnique({ where: { id: SETTINGS_ID } }),
    tx.analysisEntitlement.findMany({ where: { userId: { in: userIds } } }),
    tx.analysisReservation.groupBy({
      by: ["userId", "source"],
      where: {
        userId: { in: userIds },
        status: { in: CREDIT_RESERVATION_STATUSES },
      },
      _count: { _all: true },
    }),
  ]);
  const entitlementsByUserId = new Map(entitlements.map((entitlement) => [entitlement.userId, entitlement]));
  const usageByUserAndSource = new Map(
    usage.map((item) => [`${item.userId}:${item.source}`, item._count._all]),
  );

  return userIds.map((userId) => {
    const entitlement = entitlementsByUserId.get(userId);
    const freeRemaining = Math.max(FREE_CREDITS_PER_ACCOUNT - (usageByUserAndSource.get(`${userId}:FREE`) ?? 0), 0);
    const bonusRemaining = Math.max((entitlement?.bonusCreditsGranted ?? 0) - (usageByUserAndSource.get(`${userId}:BONUS`) ?? 0), 0);
    const premiumRemaining = Math.max((entitlement?.premiumCreditsGranted ?? 0) - (usageByUserAndSource.get(`${userId}:PREMIUM`) ?? 0), 0);

    return {
      userId,
      premiumEnabled: settings?.premiumEnabled ?? false,
      freeRemaining,
      bonusRemaining,
      premiumRemaining,
      remaining: freeRemaining + bonusRemaining + premiumRemaining,
    };
  });
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

export async function applyCreditCoupon(tx, {
  userId,
  couponId,
  grantedByUserId,
  grantedByEmail,
}) {
  const lockedCoupon = await tx.$queryRaw`
    SELECT id
    FROM credit_coupons
    WHERE id = ${couponId}::uuid
    FOR UPDATE
  `;
  if (lockedCoupon.length === 0) {
    throw new CreditCouponError("COUPON_NOT_FOUND", "Coupon was not found");
  }

  const coupon = await tx.creditCoupon.findUnique({ where: { id: couponId } });
  if (!coupon.isActive) {
    throw new CreditCouponError("COUPON_INACTIVE", "Coupon is inactive");
  }
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    throw new CreditCouponError("COUPON_EXPIRED", "Coupon has expired");
  }
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new CreditCouponError("COUPON_USAGE_LIMIT_REACHED", "Coupon usage limit reached");
  }

  const previousGrant = await tx.adminCreditGrant.findFirst({
    where: { couponId, userId },
    select: { id: true },
  });
  if (previousGrant) {
    throw new CreditCouponError("COUPON_ALREADY_APPLIED", "Coupon already applied for this user");
  }

  const entitlement = await getLockedEntitlement(tx, userId);
  await tx.creditCoupon.update({
    where: { id: couponId },
    data: { usedCount: { increment: 1 } },
  });
  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: { bonusCreditsGranted: { increment: coupon.creditsGranted } },
  });
  await tx.adminCreditGrant.create({
    data: {
      userId,
      grantedByUserId,
      grantedByEmail,
      couponId,
      creditsGranted: coupon.creditsGranted,
      source: "COUPON",
    },
  });
  return getEntitlementSummary(tx, userId);
}

export async function grantGroblePurchase(tx, input) {
  const entitlement = await getLockedEntitlement(tx, input.userId);
  const settings = await tx.entitlementSetting.findUnique({ where: { id: SETTINGS_ID } });
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
