const SETTINGS_ID = "singleton";
const FREE_CREDITS_PER_ACCOUNT = 1;
const CREDIT_RESERVATION_STATUSES = ["PENDING", "CONSUMED"];

export class EntitlementUnavailableError extends Error {
  constructor() {
    super("Analysis credits are exhausted");
    this.code = "ANALYSIS_CREDITS_EXHAUSTED";
  }
}

function isUniqueConstraintError(error) {
  return error?.code === "P2002";
}

async function getLockedEntitlement(tx, userId) {
  try {
    await tx.analysisEntitlement.create({ data: { userId } });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
  }

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
  const [settings, freeUsed, premiumUsed] = await Promise.all([
    tx.entitlementSetting.findUnique({ where: { id: SETTINGS_ID } }),
    getUsage(tx, userId, "FREE"),
    getUsage(tx, userId, "PREMIUM"),
  ]);
  const freeRemaining = Math.max(FREE_CREDITS_PER_ACCOUNT - freeUsed, 0);
  const premiumRemaining = Math.max(entitlement.premiumCreditsGranted - premiumUsed, 0);

  return {
    premiumEnabled: settings?.premiumEnabled ?? false,
    freeRemaining,
    premiumRemaining,
    remaining: freeRemaining + premiumRemaining,
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

  const source = summary.freeRemaining > 0 ? "FREE" : "PREMIUM";
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
  const settings = await tx.entitlementSetting.findUnique({ where: { id: SETTINGS_ID } });
  const credits = settings?.premiumCreditsPerPurchase ?? 3;

  try {
    await tx.paymentEntitlement.create({
      data: {
        userId: input.userId,
        providerPaymentId: input.providerPaymentId,
        creditsGranted: credits,
        rawEvent: input.rawEvent,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return { granted: false, credits: 0 };
    }
    throw error;
  }

  await tx.analysisEntitlement.update({
    where: { userId: entitlement.userId },
    data: {
      premiumCreditsGranted: { increment: credits },
    },
  });

  return { granted: true, credits };
}
