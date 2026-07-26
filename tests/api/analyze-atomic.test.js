import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/auth.js";
import { EntitlementUnavailableError } from "../../lib/analysis-entitlements.js";
import { createAnalyzeHandler } from "../../api/analyze.js";
import { runAllocatedAnalysis } from "../../lib/analysis-request-lifecycle.js";

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
  const resolvedExistingRequest = existingRequest
    ? { idempotencyKey: IDEMPOTENCY_KEY, ...existingRequest }
    : null;
  const db = {
    $transaction: async (work) => work(db),
    analysis: {
      create: vi.fn(async ({ data }) => ({ id: "analysis-1", ...data })),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditEvent: {
      create: vi.fn(async ({ data }) => ({ id: "audit-1", ...data })),
    },
    analysisRequest: {
      create: vi.fn(async ({ data }) => ({ id: "request-1", ...data })),
      findFirst: vi.fn(async ({ where }) => (
        where.status.in.includes(resolvedExistingRequest?.status)
          ? resolvedExistingRequest
          : null
      )),
      findMany: vi.fn(async () => (
        resolvedExistingRequest?.status === "PENDING" && resolvedExistingRequest.expiresAt
          ? [resolvedExistingRequest]
          : []
      )),
      findUnique: vi.fn(async ({ where }) => (
        resolvedExistingRequest?.idempotencyKey === where.userId_idempotencyKey.idempotencyKey
          ? resolvedExistingRequest
          : null
      )),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async ({ data }) => {
        if (resolvedExistingRequest && typeof data?.status === "string") {
          resolvedExistingRequest.status = data.status;
        }
        return { count: 1 };
      }),
    },
    analysisReservation: {
      updateMany: vi.fn(async () => ({ count: 1 })),
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

  it("accepts a valid analysis before running its queued model work", async () => {
    const queuedWork = [];
    const model = vi.fn(async () => ({ report: "complete" }));
    const handler = createAnalyzeHandler({
      db: createDatabase(),
      enqueueBackgroundWork: (work) => queuedWork.push(work),
      model,
      requireUser: activeUser,
      reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({
      analysis_id: "analysis-1",
      analysis_request_id: "request-1",
      project_id: "project-1",
      status: "PENDING",
    });
    expect(res.body).not.toHaveProperty("report");
    expect(model).not.toHaveBeenCalled();
    expect(queuedWork).toHaveLength(1);
  });

  it("claims concurrent queued work once without cancelling the winning reservation", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createDatabase();
    let status = "PENDING";
    db.analysisRequest.updateMany = vi.fn(async ({ data, where }) => {
      if (where.status === "PENDING" && data.status === "CALLING") {
        if (status !== "PENDING") return { count: 0 };
        status = "CALLING";
        return { count: 1 };
      }
      if (where.status === "CALLING" && data.status === "PERSISTENCE_PENDING") {
        if (status !== "CALLING") return { count: 0 };
        status = "PERSISTENCE_PENDING";
        return { count: 1 };
      }
      if (where.status === "PERSISTENCE_PENDING" && data.status === "SUCCEEDED") {
        if (status !== "PERSISTENCE_PENDING") return { count: 0 };
        status = "SUCCEEDED";
        return { count: 1 };
      }
      return { count: 0 };
    });
    const cancelReservation = vi.fn(async () => undefined);
    const finalizeReservation = vi.fn(async () => undefined);
    const model = vi.fn(async () => ({
      analysisMeta: {
        modelName: "test-model",
        modelProvider: "test-provider",
        responseTimeMs: 1,
        tokenUsage: { completionTokens: 1, promptTokens: 1, totalTokens: 2 },
      },
      report: "complete",
    }));
    const allocation = {
      analysis: { id: "analysis-1" },
      analysisRequest: { id: "request-1" },
      reservation: { reservationId: "reservation-1" },
    };

    try {
      await Promise.all(Array.from({ length: 10 }, () => runAllocatedAnalysis({
        allocation,
        cancel: cancelReservation,
        db,
        finalize: finalizeReservation,
        model,
        request: request().body,
        requestId: "request-id",
        userId: USER_ID,
      })));

      expect(model).toHaveBeenCalledTimes(1);
      expect(finalizeReservation).toHaveBeenCalledTimes(1);
      expect(cancelReservation).not.toHaveBeenCalled();
      expect(errorLog).not.toHaveBeenCalled();
      expect(status).toBe("SUCCEEDED");
    } finally {
      errorLog.mockRestore();
    }
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

  it("returns an accepted receipt while an idempotent request is already pending", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase({
        existingRequest: {
          analysis: { id: "analysis-1", projectId: "project-1" },
          analysisId: "analysis-1",
          id: "request-1",
          requestHash: requestHash(),
          status: "PENDING",
        },
      }),
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({
      analysis_id: "analysis-1",
      analysis_request_id: "request-1",
      project_id: "project-1",
      status: "PENDING",
    });
    expect(res.body).not.toHaveProperty("report");
    expect(model).not.toHaveBeenCalled();
  });

  it("expires a stranded pending request and cancels its reservation before rejecting the old key", async () => {
    const model = vi.fn();
    const db = createDatabase({
      existingRequest: {
        analysis: { id: "analysis-1", projectId: "project-1" },
        analysisId: "analysis-1",
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "request-1",
        idempotencyKey: IDEMPOTENCY_KEY,
        requestHash: requestHash(),
        reservationId: "reservation-1",
        status: "PENDING",
      },
    });
    const handler = createAnalyzeHandler({
      db,
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("ANALYSIS_RETRY_WITH_NEW_KEY");
    expect(db.analysis.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "analysis-1", status: "PENDING", userId: USER_ID },
    }));
    expect(db.analysisReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "reservation-1", status: "PENDING", userId: USER_ID },
    }));
    expect(model).not.toHaveBeenCalled();
  });

  it("does not auto-refund an expired CALLING request with an ambiguous provider outcome", async () => {
    const model = vi.fn();
    const db = createDatabase({
      existingRequest: {
        analysis: { id: "analysis-1", projectId: "project-1" },
        analysisId: "analysis-1",
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "request-1",
        requestHash: requestHash(),
        reservationId: "reservation-1",
        status: "CALLING",
      },
    });
    const handler = createAnalyzeHandler({
      db,
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({
      analysis_id: "analysis-1",
      analysis_request_id: "request-1",
      project_id: "project-1",
      status: "CALLING",
    });
    expect(res.body).not.toHaveProperty("report");
    expect(db.analysis.updateMany).not.toHaveBeenCalled();
    expect(db.analysisReservation.updateMany).not.toHaveBeenCalled();
    expect(model).not.toHaveBeenCalled();
  });

  it("blocks a refreshed key from re-calling the model while the same input is CALLING", async () => {
    const model = vi.fn();
    const consumeRateLimit = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 1 }));
    const db = createDatabase({
      existingRequest: {
        analysisId: "analysis-1",
        id: "request-1",
        idempotencyKey: "previous-calling-request-1234",
        requestHash: requestHash(),
        reservationId: "reservation-1",
        status: "CALLING",
      },
    });
    const handler = createAnalyzeHandler({
      db,
      model,
      requireUser: activeUser,
      consumeRateLimit,
    });
    const res = response();

    await handler(request({ headers: { "idempotency-key": "refreshed-analysis-request-1234" } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("ANALYSIS_IN_PROGRESS");
    expect(model).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
  });

  it("releases another expired reservation before allowing a new idempotency key", async () => {
    const db = createDatabase({
      existingRequest: {
        analysisId: "stale-analysis",
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        id: "stale-request",
        idempotencyKey: "stale-analysis-key-1234",
        requestHash: requestHash(),
        reservationId: "stale-reservation",
        status: "PENDING",
      },
    });
    const model = vi.fn(async () => ({ report: "fresh" }));
    const queuedWork = [];
    const handler = createAnalyzeHandler({
      db,
      enqueueBackgroundWork: (work) => queuedWork.push(work),
      model,
      requireUser: activeUser,
      reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request({ headers: { "idempotency-key": "fresh-analysis-request-1234" } }), res);

    expect(res.statusCode).toBe(202);
    expect(db.analysisReservation.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "stale-reservation", status: "PENDING", userId: USER_ID },
    }));
    expect(model).not.toHaveBeenCalled();
    await queuedWork[0]();
    expect(model).toHaveBeenCalledTimes(1);
  });

  it("returns a stored receipt when the matching idempotent request already succeeded", async () => {
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
      status: "SUCCEEDED",
    });
    expect(res.body).not.toHaveProperty("report");
    expect(model).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(db.entitlementSetting.findUnique).not.toHaveBeenCalled();
  });

  it("finishes a staged provider result on an idempotent retry without another model call", async () => {
    const model = vi.fn();
    const existingRequest = {
      analysis: { id: "analysis-1", projectId: "project-1" },
      analysisId: "analysis-1",
      id: "request-1",
      providerMetadata: {
        modelName: "test-model",
        modelProvider: "test-provider",
        responseTimeMs: 12,
        tokenUsage: { completionTokens: 2, promptTokens: 1, totalTokens: 3 },
      },
      providerResult: { report: "staged" },
      requestHash: requestHash(),
      reservationId: "reservation-1",
      status: "PERSISTENCE_PENDING",
    };
    const db = createDatabase({ existingRequest });
    const finalizeReservation = vi.fn(async () => undefined);
    const handler = createAnalyzeHandler({
      db,
      finalizeReservation,
      model,
      requireUser: activeUser,
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      analysis_id: "analysis-1",
      project_id: "project-1",
      status: "SUCCEEDED",
    });
    expect(res.body).not.toHaveProperty("report");
    expect(finalizeReservation).toHaveBeenCalledWith(expect.anything(), "reservation-1", USER_ID);
    expect(model).not.toHaveBeenCalled();
  });

  it("recovers a staged result after a refresh supplies a new idempotency key", async () => {
    const model = vi.fn();
    const consumeRateLimit = vi.fn(async () => ({ allowed: true, retryAfterSeconds: 1 }));
    const existingRequest = {
      analysis: { id: "analysis-1", projectId: "project-1" },
      analysisId: "analysis-1",
      id: "request-1",
      idempotencyKey: "previous-staged-request-1234",
      providerMetadata: {
        modelName: "test-model",
        modelProvider: "test-provider",
        responseTimeMs: 12,
        tokenUsage: { completionTokens: 2, promptTokens: 1, totalTokens: 3 },
      },
      providerResult: { report: "staged" },
      requestHash: requestHash(),
      reservationId: "reservation-1",
      status: "PERSISTENCE_PENDING",
    };
    const handler = createAnalyzeHandler({
      db: createDatabase({ existingRequest }),
      finalizeReservation: vi.fn(async () => undefined),
      model,
      requireUser: activeUser,
      consumeRateLimit,
    });
    const res = response();

    await handler(request({ headers: { "idempotency-key": "refreshed-analysis-request-1234" } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ analysis_id: "analysis-1", status: "SUCCEEDED" });
    expect(res.body).not.toHaveProperty("report");
    expect(model).not.toHaveBeenCalled();
    expect(consumeRateLimit).not.toHaveBeenCalled();
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

  it("returns an opaque credit-exhausted response without calling the model", async () => {
    const model = vi.fn();
    const handler = createAnalyzeHandler({
      db: createDatabase(),
      model,
      requireUser: activeUser,
      reserveAnalysis: async () => {
        throw new EntitlementUnavailableError();
      },
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      error: "ANALYSIS_CREDITS_EXHAUSTED",
      requestId: expect.any(String),
    });
    expect(model).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("Analysis credits are exhausted");
  });

  it("finalizes a reservation only after persisting a successful report", async () => {
    const finalizeReservation = vi.fn(async () => undefined);
    const cancelReservation = vi.fn(async () => undefined);
    const db = createDatabase();
    const queuedWork = [];
    const handler = createAnalyzeHandler({
      cancelReservation,
      db,
      enqueueBackgroundWork: (work) => queuedWork.push(work),
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

    expect(res.statusCode).toBe(202);
    await queuedWork[0]();
    expect(db.analysis.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "SUCCESS" }),
      where: { id: "analysis-1" },
    }));
    expect(db.analysisRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ providerMetadata: null, providerResult: null, status: "SUCCEEDED" }),
      where: { id: "request-1", status: "PERSISTENCE_PENDING" },
    }));
    expect(finalizeReservation).toHaveBeenCalledWith(expect.anything(), "reservation-1", USER_ID);
    expect(cancelReservation).not.toHaveBeenCalled();
  });

  it("persists a valid Gemini result that arrives after the former 45 second cutoff", async () => {
    vi.useFakeTimers();
    const db = createDatabase();
    const res = response();
    const queuedWork = [];
    const fetchMock = vi.fn((_url, { signal }) => new Promise((resolve, reject) => {
      const responseTimer = setTimeout(() => {
        resolve({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: "{}" }] } }],
            usageMetadata: { candidatesTokenCount: 1, promptTokenCount: 1, totalTokenCount: 2 },
          }),
        });
      }, 50_000);
      signal.addEventListener("abort", () => {
        clearTimeout(responseTimer);
        reject(new DOMException("The operation was aborted.", "AbortError"));
      }, { once: true });
    }));
    vi.stubEnv("GEMINI_API_KEY", "test-gemini-key");
    vi.stubGlobal("fetch", fetchMock);

    try {
      const handler = createAnalyzeHandler({
        db,
        enqueueBackgroundWork: (work) => queuedWork.push(work),
        requireUser: activeUser,
        reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
        consumeRateLimit: rateAllowed,
      });
      await handler(request(), res);
      const backgroundPromise = queuedWork[0]();

      await vi.advanceTimersByTimeAsync(50_000);
      await backgroundPromise;

      expect(res.statusCode).toBe(202);
      expect(res.body).toMatchObject({
        analysis_id: "analysis-1",
        project_id: "project-1",
        status: "PENDING",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db.analysis.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS" }),
        where: { id: "analysis-1" },
      }));
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("marks the request failed and cancels the reservation when the model fails", async () => {
    const finalizeReservation = vi.fn(async () => undefined);
    const cancelReservation = vi.fn(async () => undefined);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = createDatabase();
    const queuedWork = [];
    const handler = createAnalyzeHandler({
      cancelReservation,
      db,
      enqueueBackgroundWork: (work) => queuedWork.push(work),
      finalizeReservation,
      model: async () => {
        throw new Error("provider details must not leave the server");
      },
      requireUser: activeUser,
      reserveAnalysis: async () => ({ reservationId: "reservation-1" }),
      consumeRateLimit: rateAllowed,
    });
    const res = response();

    try {
      await handler(request(), res);
      await queuedWork[0]();

      expect(res.statusCode).toBe(202);
      expect(res.body).toMatchObject({ status: "PENDING", requestId: expect.any(String) });
      expect(db.analysis.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ errorCode: "API_ERROR", status: "FAILED" }),
        where: { id: "analysis-1", status: "PENDING", userId: USER_ID },
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

      expect(errorLog).toHaveBeenCalledWith("[api/analyze] model call failed", {
        code: "API_ERROR",
        providerStatusCode: null,
        requestId: expect.any(String),
      });
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain("provider details must not leave the server");
    } finally {
      errorLog.mockRestore();
    }
  });

  it("does not refund a completed provider call when report persistence fails", async () => {
    const cancelReservation = vi.fn(async () => undefined);
    const db = createDatabase();
    const queuedWork = [];
    db.tokenUsage.create.mockRejectedValue(new Error("database write unavailable"));
    const handler = createAnalyzeHandler({
      cancelReservation,
      db,
      enqueueBackgroundWork: (work) => queuedWork.push(work),
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
    await queuedWork[0]();

    expect(res.statusCode).toBe(202);
    expect(res.body).toMatchObject({ status: "PENDING" });
    expect(cancelReservation).not.toHaveBeenCalled();
    expect(db.analysisRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PERSISTENCE_PENDING" }),
      where: { id: "request-1", status: "CALLING" },
    }));
    expect(db.analysisRequest.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "FAILED" },
      where: { id: "request-1", status: "CALLING" },
    }));
  });
});
