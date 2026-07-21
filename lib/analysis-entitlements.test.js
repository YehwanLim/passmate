import { describe, expect, it } from "vitest";

import {
  cancelAnalysisReservation,
  finalizeAnalysisReservation,
  getEntitlementSummary,
  grantGroblePurchase,
  reserveAnalysis,
} from "./analysis-entitlements.js";

function createMemoryDatabase() {
  const state = {
    entitlements: new Map(),
    lockedUserIds: [],
    payments: new Map(),
    reservations: [],
    settings: {
      id: "singleton",
      premiumEnabled: false,
      premiumCreditsPerPurchase: 3,
    },
  };
  let nextReservationId = 1;

  const db = {
    $queryRaw: async (_strings, ...values) => {
      state.lockedUserIds.push(values[0]);
      return [];
    },
    analysisEntitlement: {
      create: async ({ data }) => {
        if (state.entitlements.has(data.userId)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        const entitlement = {
          id: `entitlement-${data.userId}`,
          premiumCreditsGranted: 0,
          userId: data.userId,
        };
        state.entitlements.set(data.userId, entitlement);
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
    paymentEntitlement: {
      create: async ({ data }) => {
        if (state.payments.has(data.providerPaymentId)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        state.payments.set(data.providerPaymentId, { ...data });
        return { ...data };
      },
    },
  };

  return { db, state };
}

describe("analysis entitlements", () => {
  it("gives a new account one free analysis and then blocks a second reservation", async () => {
    const { db } = createMemoryDatabase();

    const first = await reserveAnalysis(db, "user-1");
    await finalizeAnalysisReservation(db, first.reservationId, "user-1");

    await expect(reserveAnalysis(db, "user-1")).rejects.toMatchObject({
      code: "ANALYSIS_CREDITS_EXHAUSTED",
    });
  });

  it("grants exactly three credits once when Groble retries a paid event", async () => {
    const { db } = createMemoryDatabase();

    await grantGroblePurchase(db, {
      providerPaymentId: "pay-1",
      rawEvent: {},
      userId: "user-1",
    });
    const duplicate = await grantGroblePurchase(db, {
      providerPaymentId: "pay-1",
      rawEvent: {},
      userId: "user-1",
    });

    expect(duplicate).toEqual({ granted: false, credits: 0 });
    await expect(getEntitlementSummary(db, "user-1")).resolves.toMatchObject({
      premiumRemaining: 3,
    });
  });

  it("holds a pending credit until cancelling its reservation", async () => {
    const { db, state } = createMemoryDatabase();

    const reservation = await reserveAnalysis(db, "user-1");
    await expect(reserveAnalysis(db, "user-1")).rejects.toMatchObject({
      code: "ANALYSIS_CREDITS_EXHAUSTED",
    });

    await cancelAnalysisReservation(db, reservation.reservationId, "user-1");
    await expect(reserveAnalysis(db, "user-1")).resolves.toMatchObject({
      source: "free",
    });
    expect(state.lockedUserIds).toContain("user-1");
  });
});
