import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/auth.js";
import { createAnalyzeHandler } from "../../api/analyze.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "analysis-request-key-1234";

function request(overrides = {}) {
  return {
    body: {
      company: "PassMate",
      jobKeyword: "Product Manager",
      questions: [{ question: "지원 동기는 무엇인가요?", answer: "가".repeat(200) }],
    },
    headers: { "idempotency-key": IDEMPOTENCY_KEY },
    method: "POST",
    ...overrides,
  };
}

function response() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
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

function requestHash() {
  return createHash("sha256")
    .update(JSON.stringify(request().body))
    .digest("hex");
}

function createDatabase({ existingRequest = null, analysisEnabled = true } = {}) {
  const db = {
    $transaction: async (work) => work(db),
    analysis: {
      create: vi.fn(async ({ data }) => ({ id: "analysis-1", ...data })),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
    },
    auditEvent: {
      create: vi.fn(async ({ data }) => ({ id: "audit-1", ...data })),
    },
    analysisRequest: {
      create: vi.fn(async ({ data }) => ({ id: "request-1", ...data })),
      findUnique: vi.fn(async () => existingRequest),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
    },
    entitlementSetting: {
      findUnique: vi.fn(async () => ({ analysisEnabled })),
    },
    project: {
      create: vi.fn(async ({ data }) => ({ id: "project-1", ...data })),
    },
    tokenUsage: {
      create: vi.fn(async ({ data }) => ({ id: "token-1", ...data })),
    },
  };
  return db;
}

const activeUser = async () => ({ applicationUser: { id: USER_ID } });
const rateAllowed = async () => ({ allowed: true, retryAfterSeconds: 1 });

describe("atomic analyze API", () => {
  it("rejects an unauthenticated analysis before the model is called", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase(),
      model,
      requireUser: async () => {
        throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "secret");
      },
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("AUTHENTICATION_REQUIRED");
    expect(model).not.toHaveBeenCalled();
  });

  it("rejects a reused idempotency key with a different normalized request", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase({
        existingRequest: { requestHash: "a".repeat(64), status: "PENDING" },
      }),
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(model).not.toHaveBeenCalled();
  });

  it("returns a conflict while an idempotent request is already pending", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase({
        existingRequest: { requestHash: requestHash(), status: "PENDING" },
      }),
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("ANALYSIS_IN_PROGRESS");
    expect(model).not.toHaveBeenCalled();
  });

  it("returns a stored report when the matching idempotent request already succeeded", async () => {
    const model = vi.fn();
    const consumeRateLimit = vi.fn(async () => ({ allowed: false, retryAfterSeconds: 900 }));
    const existingRequest = {
      analysis: { aiResponseJson: { report: "stored" }, id: "analysis-1", projectId: "project-1" },
      requestHash: requestHash(),
      status: "SUCCEEDED",
    };
    const db = createDatabase({ existingRequest });
    const handler = createAnalyzeHandler({
      db,
      model,
      requireUser: activeUser,
      consumeRateLimit,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      analysis_id: "analysis-1",
      project_id: "project-1",
      report: { report: "stored" },
    });
    expect(model).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(db.entitlementSetting.findUnique).not.toHaveBeenCalled();
  });

  it("stops before the model when the user has exceeded the analysis rate limit", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase(),
      model,
      requireUser: activeUser,
      consumeRateLimit: async () => ({ allowed: false, retryAfterSeconds: 900 }),
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toBe("RATE_LIMITED");
    expect(res.headers["Retry-After"]).toBe("900");
    expect(model).not.toHaveBeenCalled();
  });

  it("stops before the model when the analysis kill switch is disabled", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase({ analysisEnabled: false }),
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe("ANALYSIS_DISABLED");
    expect(model).not.toHaveBeenCalled();
  });

  it("finalizes a reservation only after persisting a successful report", async () => {
    const finalizeReservation = vi.fn(async () => undefined);
    const cancelReservation = vi.fn(async () => undefined);
    const db = createDatabase();
    const handler = createAnalyzeHandler({
      cancelReservation,
      db,
      finalizeReservation,
      model: async () => ({
        analysisMeta: {
          modelName: "test-model",
          modelProvider: "test-provider",
          responseTimeMs: 12,
          tokenUsage: { completionTokens: 2, promptTokens: 1, totalTokens: 3 },
        },
        report: "complete",
      }),
      requireUser: activeUser,
      reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(db.analysis.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUCCESS" }),
      where: { id: "analysis-1" },
    }));
    expect(finalizeReservation).toHaveBeenCalledWith(expect.anything(), "reservation-1", USER_ID);
    expect(cancelReservation).not.toHaveBeenCalled();
  });

  it("marks the request failed and cancels the reservation when the model fails", async () => {
    const finalizeReservation = vi.fn(async () => undefined);
    const cancelReservation = vi.fn(async () => undefined);
    const db = createDatabase();
    const handler = createAnalyzeHandler({
      cancelReservation,
      db,
      finalizeReservation,
      model: async () => {
        throw new Error("provider details must not leave the server");
      },
      requireUser: activeUser,
      reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "ANALYSIS_FAILED", requestId: expect.any(String) });
    expect(db.analysis.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ errorCode: "API_ERROR", status: "FAILED" }),
      where: { id: "analysis-1" },
    }));
    expect(cancelReservation).toHaveBeenCalledWith(expect.anything(), "reservation-1", USER_ID);
    expect(finalizeReservation).not.toHaveBeenCalled();
    expect(db.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        actorId: USER_ID,
        outcome: "API_ERROR",
        targetId: "analysis-1",
        targetType: "analysis",
      }),
    }));
  });
});
