import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/auth.js";
import { createAnalysisRequestStatusHandler } from "../../api/analysis-requests/[id].js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

function request(overrides = {}) {
  return {
    headers: {},
    method: "GET",
    query: { id: "request-1" },
    ...overrides,
  };
}

function response() {
  return {
    body: undefined,
    headers: {},
    statusCode: null,
    json(body) {
      this.body = body;
      return body;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

function createDatabase({ stored } = {}) {
  let current = stored ? { ...stored } : null;
  const db = {
    $transaction: async (work) => work(db),
    analysis: {
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    analysisRequest: {
      findFirst: vi.fn(async ({ where }) => (
        current?.id === where.id && current?.userId === where.userId ? current : null
      )),
      findUnique: vi.fn(async ({ where }) => (
        current?.idempotencyKey === where.userId_idempotencyKey.idempotencyKey ? current : null
      )),
      updateMany: vi.fn(async ({ data, where }) => {
        if (!current || where.id !== current.id || where.status !== current.status) {
          return { count: 0 };
        }
        current = { ...current, ...data };
        return { count: 1 };
      }),
    },
    analysisReservation: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditEvent: {
      create: vi.fn(async ({ data }) => ({ id: "audit-1", ...data })),
    },
    tokenUsage: {
      create: vi.fn(async ({ data }) => ({ id: "token-1", ...data })),
    },
  };
  return { db, getCurrent: () => current };
}

const activeUser = async () => ({ applicationUser: { id: USER_ID } });

function storedRequest(overrides = {}) {
  return {
    analysis: { errorCode: null, id: "analysis-1", projectId: "project-1" },
    analysisId: "analysis-1",
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    id: "request-1",
    idempotencyKey: "analysis-request-key-1234",
    providerMetadata: null,
    providerResult: null,
    requestHash: "a".repeat(64),
    reservationId: "reservation-1",
    status: "SUCCEEDED",
    userId: USER_ID,
    ...overrides,
  };
}

describe("GET /api/analysis-requests/:id", () => {
  it("returns an opaque 401 response before looking up a request", async () => {
    const { db } = createDatabase();
    const handler = createAnalysisRequestStatusHandler({
      db,
      requireUser: async () => {
        throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "private authentication detail");
      },
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "AUTHENTICATION_REQUIRED",
      requestId: expect.any(String),
    });
    expect(db.analysisRequest.findFirst).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("private authentication detail");
  });

  it("looks up a request by both its ID and the verified user ID before returning 404", async () => {
    const { db } = createDatabase({
      stored: storedRequest({ id: "another-users-request", userId: "other-user" }),
    });
    const handler = createAnalysisRequestStatusHandler({ db, requireUser: activeUser });
    const res = response();

    await handler(request({ query: { id: "another-users-request" } }), res);

    expect(db.analysisRequest.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "another-users-request", userId: USER_ID },
    }));
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("returns only the safe completion projection for the owner", async () => {
    const { db } = createDatabase({
      stored: storedRequest({
        providerMetadata: { privateProviderDetail: "do-not-return" },
        providerResult: { report: "do-not-return" },
      }),
    });
    const handler = createAnalysisRequestStatusHandler({ db, requireUser: activeUser });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      id: "request-1",
      status: "SUCCEEDED",
      analysis_id: "analysis-1",
      error: null,
      requestId: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("providerResult");
    expect(JSON.stringify(res.body)).not.toContain("do-not-return");
  });

  it("keeps an expired CALLING request in result confirmation without auto-refunding", async () => {
    const { db, getCurrent } = createDatabase({
      stored: storedRequest({
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        status: "CALLING",
      }),
    });
    const handler = createAnalysisRequestStatusHandler({ db, requireUser: activeUser });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      id: "request-1",
      status: "CALLING",
      analysis_id: null,
      error: null,
      requestId: expect.any(String),
    });
    expect(getCurrent().status).toBe("CALLING");
    expect(db.analysis.updateMany).not.toHaveBeenCalled();
    expect(db.analysisReservation.updateMany).not.toHaveBeenCalled();
  });

  it("recovers a staged provider result before returning a successful status", async () => {
    const { db, getCurrent } = createDatabase({
      stored: storedRequest({
        providerMetadata: {
          modelName: "test-model",
          modelProvider: "test-provider",
          responseTimeMs: 12,
          tokenUsage: { completionTokens: 2, promptTokens: 1, totalTokens: 3 },
        },
        providerResult: { report: "staged report is server-only" },
        status: "PERSISTENCE_PENDING",
      }),
    });
    const handler = createAnalysisRequestStatusHandler({ db, requireUser: activeUser });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      id: "request-1",
      status: "SUCCEEDED",
      analysis_id: "analysis-1",
      error: null,
      requestId: expect.any(String),
    });
    expect(getCurrent().status).toBe("SUCCEEDED");
    expect(db.analysisReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "CONSUMED" }),
      where: expect.objectContaining({ id: "reservation-1", userId: USER_ID }),
    }));
    expect(JSON.stringify(res.body)).not.toContain("staged report is server-only");
  });

  it("rejects a non-GET request without exposing request state", async () => {
    const { db } = createDatabase({ stored: storedRequest() });
    const handler = createAnalysisRequestStatusHandler({ db, requireUser: activeUser });
    const res = response();

    await handler(request({ method: "POST" }), res);

    expect(res.statusCode).toBe(405);
    expect(res.body.error).toBe("METHOD_NOT_ALLOWED");
    expect(db.analysisRequest.findFirst).not.toHaveBeenCalled();
  });
});
