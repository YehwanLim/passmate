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

async function getSummaryForEntitlement(tx, userId) {
  const freeUsed = await getUsage(tx, userId, "FREE");
  const freeRemaining = Math.max(FREE_CREDITS_PER_ACCOUNT - freeUsed, 0);
  const premiumRemaining = 0;

  return {
    premiumEnabled: false,
    freeRemaining,
    premiumRemaining,
    remaining: freeRemaining + premiumRemaining,
  };
}

export async function getEntitlementSummary(tx, userId) {
  await getLockedEntitlement(tx, userId);
  return getSummaryForEntitlement(tx, userId);
}

export async function reserveAnalysis(tx, userId) {
  await getLockedEntitlement(tx, userId);
  const summary = await getSummaryForEntitlement(tx, userId);

  if (summary.remaining === 0) {
    throw new EntitlementUnavailableError();
  }

  const source = "FREE";
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
