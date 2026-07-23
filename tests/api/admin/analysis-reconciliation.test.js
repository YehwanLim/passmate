import { describe, expect, it, vi } from "vitest";

import { createAnalysisReconciliationHandler } from "../../../lib/admin-handlers/analysis-reconciliation.js";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const ANALYSIS_ID = "33333333-3333-4333-8333-333333333333";

function response() {
  return {
    body: undefined,
    statusCode: null,
    json(body) { this.body = body; return body; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

function database({ status = "CALLING" } = {}) {
  const db = {
    $transaction: async (work) => work(db),
    analysis: { updateMany: vi.fn(async () => ({ count: 1 })) },
    analysisRequest: {
      findUnique: vi.fn(async () => ({
        analysisId: ANALYSIS_ID,
        id: REQUEST_ID,
        reservationId: "44444444-4444-4444-8444-444444444444",
        status,
        userId: ADMIN_ID,
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    analysisReservation: { updateMany: vi.fn(async () => ({ count: 1 })) },
    auditEvent: { create: vi.fn(async () => ({ id: "audit-1" })) },
  };
  return db;
}

function request({ action = "cancel", method = "POST" } = {}) {
  return {
    body: { action },
    headers: { "x-request-id": "reconciliation-test" },
    method,
    query: { id: REQUEST_ID },
  };
}

describe("analysis reconciliation admin handler", () => {
  it("requires an administrator before resolving an uncertain provider call", async () => {
    const db = database();
    const handler = createAnalysisReconciliationHandler({
      db,
      requireAdmin: async () => { throw Object.assign(new Error("hidden"), { statusCode: 403 }); },
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Request failed", requestId: "reconciliation-test" });
    expect(db.analysisRequest.findUnique).not.toHaveBeenCalled();
  });

  it("cancels only a claimed CALLING request after operator reconciliation", async () => {
    const db = database();
    const handler = createAnalysisReconciliationHandler({
      db,
      requireAdmin: async () => ({ applicationUser: { id: ADMIN_ID } }),
    });
    const res = response();

    await handler(request({ action: "cancel" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ action: "cancel", requestId: "reconciliation-test" });
    expect(db.analysisRequest.updateMany).toHaveBeenCalledWith({
      where: { id: REQUEST_ID, status: "CALLING" },
      data: { status: "FAILED" },
    });
    expect(db.analysisReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CANCELLED" }),
    }));
    expect(db.analysis.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ errorCode: "API_ERROR", status: "FAILED" }),
    }));
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actorId: ADMIN_ID, outcome: "RECONCILIATION_CANCELLED" }),
    }));
  });

  it("does not resolve a request that is no longer uncertain", async () => {
    const db = database({ status: "SUCCEEDED" });
    const handler = createAnalysisReconciliationHandler({
      db,
      requireAdmin: async () => ({ applicationUser: { id: ADMIN_ID } }),
    });
    const res = response();

    await handler(request({ action: "consume" }), res);

    expect(res.statusCode).toBe(409);
    expect(db.analysisRequest.updateMany).not.toHaveBeenCalled();
  });
});
