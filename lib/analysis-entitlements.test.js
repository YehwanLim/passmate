import { describe, expect, it } from "vitest";

import {
  cancelAnalysisReservation,
  finalizeAnalysisReservation,
  getEntitlementSummary,
  getEntitlementSummaryReadOnly,
  grantAdminCredits,
  grantFeedbackCredit,
  grantGroblePurchase,
  hasClaimedFeedbackReward,
  reserveAnalysis,
} from "./analysis-entitlements.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_USER_ID = "22222222-2222-4222-8222-222222222222";

function createMemoryDatabase({ premiumEnabled = false } = {}) {
  const state = {
    entitlements: new Map(),
    lockedUserIds: [],
    payments: new Map(),
    reservations: [],
    adminGrants: [],
    feedbackGrants: [],
  };
  let nextReservationId = 1;

  const db = {
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join("?");
      if (sql.includes("INSERT INTO payment_entitlements")) {
        const [userId, providerPaymentId, credits, rawEvent] = values;
        if (state.payments.has(providerPaymentId)) {
          return [];
        }
        state.payments.set(providerPaymentId, { credits, rawEvent, userId });
        return [{ id: `payment-${state.payments.size}` }];
      }
      state.lockedUserIds.push(values[0]);
      return [];
    },
    analysisEntitlement: {
      upsert: async ({ create, where: { userId } }) => {
        const existing = state.entitlements.get(userId);
        if (existing) {
          return { ...existing };
        }

        const entitlement = {
          id: `entitlement-${create.userId}`,
          bonusCreditsGranted: 0,
          premiumCreditsGranted: 0,
          userId: create.userId,
        };
        state.entitlements.set(create.userId, entitlement);
        return { ...entitlement };
      },
      findUnique: async ({ where: { userId } }) => {
        const entitlement = state.entitlements.get(userId);
        return entitlement ? { ...entitlement } : null;
      },
      update: async ({ where: { userId }, data }) => {
        const entitlement = state.entitlements.get(userId);
        if (data.premiumCreditsGranted?.increment) {
          entitlement.premiumCreditsGranted += data.premiumCreditsGranted.increment;
        }
        if (data.bonusCreditsGranted?.increment) {
          entitlement.bonusCreditsGranted =
            (entitlement.bonusCreditsGranted ?? 0) + data.bonusCreditsGranted.increment;
        }
        return { ...entitlement };
      },
    },
    analysisReservation: {
      count: async ({ where }) =>
        state.reservations.filter(
          (reservation) =>
            reservation.userId === where.userId &&
            reservation.source === where.source &&
            where.status.in.includes(reservation.status),
        ).length,
      create: async ({ data }) => {
        const reservation = {
          id: `reservation-${nextReservationId++}`,
          ...data,
        };
        state.reservations.push(reservation);
        return { ...reservation };
      },
      updateMany: async ({ where, data }) => {
        const matching = state.reservations.filter(
          (reservation) =>
            reservation.id === where.id &&
            reservation.userId === where.userId &&
            reservation.status === where.status,
        );
        matching.forEach((reservation) => {
          reservation.status = data.status;
        });
        return { count: matching.length };
      },
    },
    entitlementSetting: {
      findUnique: async () => ({ premiumCreditsPerPurchase: 3, premiumEnabled }),
    },
    adminCreditGrant: {
      create: async ({ data }) => {
        state.adminGrants.push({ ...data });
        return { id: `grant-${state.adminGrants.length}`, ...data };
      },
    },
    // 피드백 보상은 계정당 1회다. user_id 유니크가 DB 에서 막지만,
    // 메모리 픽스처에서도 같은 규칙으로 동작해야 지급 흐름을 검증할 수 있다.
    feedbackCreditGrant: {
      count: async ({ where }) =>
        state.feedbackGrants.filter((grant) => grant.userId === where.userId).length,
      findUnique: async ({ where }) => {
        const grant = state.feedbackGrants.find((item) => item.userId === where.userId);
        return grant ? { ...grant } : null;
      },
      create: async ({ data }) => {
        if (state.feedbackGrants.some((grant) => grant.userId === data.userId)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        state.feedbackGrants.push({ ...data });
        return { id: `feedback-grant-${state.feedbackGrants.length}`, ...data };
      },
    },
  };

  return { db, state };
}

describe("analysis entitlements", () => {
  it("gives a new account one free analysis and then blocks a second reservation", async () => {
    const { db } = createMemoryDatabase();

    const first = await reserveAnalysis(db, USER_ID);
    await finalizeAnalysisReservation(db, first.reservationId, USER_ID);

    await expect(reserveAnalysis(db, USER_ID)).rejects.toMatchObject({
      code: "ANALYSIS_CREDITS_EXHAUSTED",
    });
  });

  it("keeps legacy premium credits disabled during the beta", async () => {
    const { db, state } = createMemoryDatabase();
    state.entitlements.set(USER_ID, {
      id: `entitlement-${USER_ID}`,
      premiumCreditsGranted: 3,
      userId: USER_ID,
    });
    const summary = await getEntitlementSummary(db, USER_ID);

    expect(summary).toMatchObject({
      premiumEnabled: false,
      premiumRemaining: 0,
      remaining: 1,
    });
    expect(state.lockedUserIds).toContain(USER_ID);
  });

  it("uses remaining premium credits only when premium is explicitly enabled", async () => {
    const { db, state } = createMemoryDatabase({ premiumEnabled: true });
    state.entitlements.set(USER_ID, {
      id: `entitlement-${USER_ID}`,
      premiumCreditsGranted: 2,
      userId: USER_ID,
    });

    const firstFree = await reserveAnalysis(db, USER_ID);
    await finalizeAnalysisReservation(db, firstFree.reservationId, USER_ID);

    await expect(reserveAnalysis(db, USER_ID)).resolves.toMatchObject({ source: "premium" });
    await expect(getEntitlementSummary(db, USER_ID)).resolves.toMatchObject({
      premiumEnabled: true,
      premiumRemaining: 1,
      remaining: 1,
    });
  });

  it("holds a pending credit until cancelling its reservation", async () => {
    const { db, state } = createMemoryDatabase();

    const reservation = await reserveAnalysis(db, SECOND_USER_ID);
    await expect(reserveAnalysis(db, SECOND_USER_ID)).rejects.toMatchObject({
      code: "ANALYSIS_CREDITS_EXHAUSTED",
    });

    await cancelAnalysisReservation(db, reservation.reservationId, SECOND_USER_ID);
    await expect(reserveAnalysis(db, SECOND_USER_ID)).resolves.toMatchObject({
      source: "free",
    });
    expect(state.lockedUserIds).toContain(SECOND_USER_ID);
  });

  it("grants the product's credits exactly once per provider payment", async () => {
    const { db, state } = createMemoryDatabase({ premiumEnabled: true });

    const first = await grantGroblePurchase(db, {
      credits: 3,
      providerPaymentId: "groble-100",
      rawEvent: { type: "payment.completed" },
      userId: USER_ID,
    });
    expect(first).toEqual({ granted: true, credits: 3 });
    expect(state.entitlements.get(USER_ID).premiumCreditsGranted).toBe(3);
    await expect(getEntitlementSummary(db, USER_ID)).resolves.toMatchObject({
      premiumRemaining: 3,
    });

    // 웹훅 재전송: 같은 결제 id 는 다시 지급되지 않는다
    const replay = await grantGroblePurchase(db, {
      credits: 3,
      providerPaymentId: "groble-100",
      rawEvent: { type: "payment.completed" },
      userId: USER_ID,
    });
    expect(replay).toEqual({ granted: false, credits: 0 });
    expect(state.entitlements.get(USER_ID).premiumCreditsGranted).toBe(3);
  });

  it("grants a single-plan payment exactly one credit", async () => {
    const { db, state } = createMemoryDatabase({ premiumEnabled: true });

    const grant = await grantGroblePurchase(db, {
      credits: 1,
      providerPaymentId: "groble-200",
      rawEvent: { type: "payment.completed" },
      userId: USER_ID,
    });
    expect(grant).toEqual({ granted: true, credits: 1 });
    expect(state.entitlements.get(USER_ID).premiumCreditsGranted).toBe(1);
  });

  it("rejects a Groble grant without a valid credit amount", async () => {
    const { db } = createMemoryDatabase({ premiumEnabled: true });

    await expect(
      grantGroblePurchase(db, {
        providerPaymentId: "groble-300",
        rawEvent: { type: "payment.completed" },
        userId: USER_ID,
      })
    ).rejects.toMatchObject({ code: "INVALID_CREDIT_AMOUNT" });
  });

  it("lets admin-granted bonus credits be used even while premium sales are off", async () => {
    const { db, state } = createMemoryDatabase({ premiumEnabled: false });

    const summary = await grantAdminCredits(db, {
      userId: USER_ID,
      credits: 2,
      grantedByUserId: SECOND_USER_ID,
      grantedByEmail: "admin@preview.dev",
      note: "베타 테스터",
    });

    expect(summary).toMatchObject({
      premiumEnabled: false,
      bonusRemaining: 2,
      remaining: 3,
    });
    expect(state.adminGrants).toHaveLength(1);
    expect(state.adminGrants[0]).toMatchObject({
      creditsGranted: 2,
      grantedByEmail: "admin@preview.dev",
      source: "MANUAL",
    });

    const first = await reserveAnalysis(db, USER_ID);
    expect(first.source).toBe("free");
    await finalizeAnalysisReservation(db, first.reservationId, USER_ID);

    const second = await reserveAnalysis(db, USER_ID);
    expect(second.source).toBe("bonus");
  });

  it("consumes bonus credits before premium ones", async () => {
    const { db, state } = createMemoryDatabase({ premiumEnabled: true });
    state.entitlements.set(USER_ID, {
      id: `entitlement-${USER_ID}`,
      bonusCreditsGranted: 1,
      premiumCreditsGranted: 1,
      userId: USER_ID,
    });

    const free = await reserveAnalysis(db, USER_ID);
    await finalizeAnalysisReservation(db, free.reservationId, USER_ID);
    const bonus = await reserveAnalysis(db, USER_ID);
    await finalizeAnalysisReservation(db, bonus.reservationId, USER_ID);
    const premium = await reserveAnalysis(db, USER_ID);

    expect(bonus.source).toBe("bonus");
    expect(premium.source).toBe("premium");
  });

  it("rejects grant amounts outside the allowed range", async () => {
    const { db } = createMemoryDatabase();
    for (const credits of [0, -1, 1.5, 10001]) {
      await expect(grantAdminCredits(db, {
        userId: USER_ID,
        credits,
        grantedByUserId: SECOND_USER_ID,
        grantedByEmail: "admin@preview.dev",
      })).rejects.toMatchObject({ code: "INVALID_CREDIT_AMOUNT" });
    }
  });

  it("returns the same numbers from the read-only summary without locking or creating rows", async () => {
    const { db, state } = createMemoryDatabase({ premiumEnabled: true });
    state.entitlements.set(USER_ID, {
      id: `entitlement-${USER_ID}`,
      bonusCreditsGranted: 1,
      premiumCreditsGranted: 2,
      userId: USER_ID,
    });
    const free = await reserveAnalysis(db, USER_ID);
    await finalizeAnalysisReservation(db, free.reservationId, USER_ID);
    const locksBefore = state.lockedUserIds.length;

    const readOnly = await getEntitlementSummaryReadOnly(db, USER_ID);

    expect(readOnly).toEqual(await getEntitlementSummary(db, USER_ID));
    expect(readOnly).toMatchObject({
      premiumEnabled: true,
      freeRemaining: 0,
      bonusRemaining: 1,
      premiumRemaining: 2,
      remaining: 3,
    });
    // 조회 전용 경로는 FOR UPDATE 잠금을 걸지 않는다 (뒤의 getEntitlementSummary 호출만 잠근다).
    expect(state.lockedUserIds.length).toBe(locksBefore + 1);
  });

  it("summarizes an account that has no entitlement row yet without creating one", async () => {
    const { db, state } = createMemoryDatabase();

    const summary = await getEntitlementSummaryReadOnly(db, USER_ID);

    expect(summary).toEqual({
      premiumEnabled: false,
      freeRemaining: 1,
      bonusRemaining: 0,
      premiumRemaining: 0,
      remaining: 1,
    });
    expect(state.entitlements.has(USER_ID)).toBe(false);
    expect(state.lockedUserIds).toHaveLength(0);
  });

  it("labels a raw entitlement lock failure without exposing its message", async () => {
    const { db } = createMemoryDatabase();
    const failure = new Error("database connection string must stay private");
    failure.code = "P2010";
    db.$queryRaw = async () => { throw failure; };

    await expect(getEntitlementSummary(db, USER_ID)).rejects.toMatchObject({
      code: "P2010",
      safeDiagnosticStage: "analysis_entitlement_lock",
    });
  });

  it("pays the feedback reward once and makes that credit spendable", async () => {
    const { db } = createMemoryDatabase();

    const granted = await grantFeedbackCredit(db, {
      userId: USER_ID,
      feedbackId: "feedback-1",
    });
    expect(granted).toBe(true);

    expect((await getEntitlementSummary(db, USER_ID)).bonusRemaining).toBe(1);
    expect(await hasClaimedFeedbackReward(db, USER_ID)).toBe(true);

    // 두 번째 설문은 지급 없이 통과해야 한다 — 계정당 1회.
    const again = await grantFeedbackCredit(db, {
      userId: USER_ID,
      feedbackId: "feedback-2",
    });
    expect(again).toBe(false);
    expect((await getEntitlementSummary(db, USER_ID)).bonusRemaining).toBe(1);

    // 무료 1회를 다 쓴 뒤에도 보상 크레딧으로 한 번 더 분석할 수 있어야 한다.
    await reserveAnalysis(db, USER_ID);
    const second = await reserveAnalysis(db, USER_ID);
    expect(second.source).toBe("bonus");
    expect((await getEntitlementSummary(db, USER_ID)).remaining).toBe(0);
  });

  it("keeps one account's feedback reward from blocking another's", async () => {
    const { db } = createMemoryDatabase();

    expect(await grantFeedbackCredit(db, { userId: USER_ID })).toBe(true);
    expect(await grantFeedbackCredit(db, { userId: SECOND_USER_ID })).toBe(true);

    expect((await getEntitlementSummary(db, SECOND_USER_ID)).bonusRemaining).toBe(1);
  });
});
