import { describe, expect, it } from "vitest";

import {
  cancelAnalysisReservation,
  finalizeAnalysisReservation,
  getEntitlementSummary,
  grantGroblePurchase,
  reserveAnalysis,
} from "./analysis-entitlements.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_USER_ID = "22222222-2222-4222-8222-222222222222";

function createMemoryDatabase() {
  const state = {
    entitlements: new Map(),
    lockedUserIds: [],
    payments: new Map(),
    paymentInsertAttempts: [],
    reservations: [],
    settings: {
      id: "singleton",
      premiumEnabled: false,
      premiumCreditsPerPurchase: 3,
    },
  };
  let nextReservationId = 1;

  const db = {
    $queryRaw: async (strings, ...values) => {
      if (strings[0].includes("INSERT INTO payment_entitlements")) {
        const [userId, providerPaymentId, creditsGranted, rawEvent] = values;
        state.paymentInsertAttempts.push(providerPaymentId);

        if (state.payments.has(providerPaymentId)) {
          return [];
        }

        const payment = {
          creditsGranted,
          id: `payment-${providerPaymentId}`,
          providerPaymentId,
          rawEvent: JSON.parse(rawEvent),
          userId,
        };
        state.payments.set(providerPaymentId, payment);
        return [{ id: payment.id }];
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
        entitlement.premiumCreditsGranted += data.premiumCreditsGranted.increment;
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
      findUnique: async () => ({ ...state.settings }),
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

  it("grants exactly three credits once when Groble retries a paid event", async () => {
    const { db, state } = createMemoryDatabase();

    await grantGroblePurchase(db, {
      providerPaymentId: "pay-1",
      rawEvent: {},
      userId: USER_ID,
    });
    const duplicate = await grantGroblePurchase(db, {
      providerPaymentId: "pay-1",
      rawEvent: {},
      userId: USER_ID,
    });

    expect(duplicate).toEqual({ granted: false, credits: 0 });
    await expect(getEntitlementSummary(db, USER_ID)).resolves.toMatchObject({
      premiumRemaining: 3,
    });
    expect(state.paymentInsertAttempts).toEqual(["pay-1", "pay-1"]);
  });

  it("returns an existing entitlement without a uniqueness exception", async () => {
    const { db, state } = createMemoryDatabase();

    await grantGroblePurchase(db, {
      providerPaymentId: "pay-existing",
      rawEvent: {},
      userId: USER_ID,
    });
    const summary = await getEntitlementSummary(db, USER_ID);

    expect(summary).toMatchObject({
      premiumRemaining: 3,
    });
    expect(state.entitlements).toHaveLength(1);
    expect(state.lockedUserIds).toContain(USER_ID);
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
});
