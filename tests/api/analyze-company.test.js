import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/auth.js";
import { EntitlementUnavailableError } from "../../lib/analysis-entitlements.js";
import { companyRequestHash, normalizeCompanyRequest } from "../../lib/company-analysis.js";
import analyzeHandler, { createAnalyzeHandler, createCompanyAnalyzeHandler } from "../../api/analyze.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const RESUME_ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IDEMPOTENCY_KEY = "company-request-key-1234";

function request(overrides = {}) {
  return {
    body: { company: "현대자동차", jobKeyword: "전략기획" },
    headers: { "idempotency-key": IDEMPOTENCY_KEY },
    method: "POST",
    query: { kind: "company" },
    ...overrides,
  };
}

function response() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    json(body) { this.body = body; return body; },
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

function createDatabase({ analysisEnabled = true, companyAnalysisEnabled = true, ownedResumeAnalysis = true } = {}) {
  const db = {
    $transaction: async (work) => work(db),
    $queryRaw: vi.fn(async () => []),
    analysis: {
      create: vi.fn(async ({ data }) => ({ id: "analysis-1", ...data })),
      findFirst: vi.fn(async ({ where }) => (ownedResumeAnalysis && where.id === RESUME_ANALYSIS_ID ? { id: where.id } : null)),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditEvent: { create: vi.fn(async ({ data }) => ({ id: "audit-1", ...data })) },
    analysisRequest: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => ({ id: "request-1", ...data })),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      update: vi.fn(async ({ data, where }) => ({ id: where.id, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    analysisReservation: { count: vi.fn(async () => 0), updateMany: vi.fn(async () => ({ count: 1 })) },
    analysisEntitlement: {
      findUnique: vi.fn(async ({ where: { userId } }) => ({ id: `entitlement-${userId}`, companyCreditsGranted: 1, premiumCreditsGranted: 0, userId })),
      upsert: vi.fn(async ({ where: { userId } }) => ({ id: `entitlement-${userId}`, companyCreditsGranted: 1, premiumCreditsGranted: 0, userId })),
    },
    entitlementSetting: {
      findUnique: vi.fn(async () => ({ analysisEnabled, premiumEnabled: false, companyAnalysisEnabled })),
    },
    project: { create: vi.fn(async ({ data }) => ({ id: "project-1", ...data })) },
    tokenUsage: { create: vi.fn(async ({ data }) => ({ id: "token-1", ...data })) },
  };
  return db;
}

const activeUser = async () => ({ applicationUser: { id: USER_ID } });
const rateAllowed = async () => ({ allowed: true, retryAfterSeconds: 1 });
const companySummary = async () => ({
  premiumEnabled: false, freeRemaining: 1, bonusRemaining: 0, premiumRemaining: 0, remaining: 1,
  companyAnalysisEnabled: true, companyRemaining: 1,
});

function companyHandler(overrides = {}) {
  return createCompanyAnalyzeHandler({
    consumeRateLimit: rateAllowed,
    enqueueBackgroundWork: () => {},
    getEntitlementSummary: companySummary,
    model: vi.fn(),
    requireUser: activeUser,
    reserveAnalysis: vi.fn(async (_tx, _userId, kind) => ({ reservationId: "reservation-1", source: "premium", kind })),
    ...overrides,
  });
}

describe("company analysis API", () => {
  it("rejects an unauthenticated request before reading the body", async () => {
    const model = vi.fn();
    const handler = companyHandler({
      db: createDatabase(),
      model,
      requireUser: async () => { throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "secret"); },
    });
    const res = response();

    await handler(request({ body: "{not json" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "AUTHENTICATION_REQUIRED", requestId: expect.any(String) });
    expect(model).not.toHaveBeenCalled();
  });

  it("rejects non-POST methods", async () => {
    const res = response();
    await companyHandler({ db: createDatabase() })(request({ method: "GET" }), res);
    expect(res.statusCode).toBe(405);
  });

  it("rejects a résumé-shaped body on the company route", async () => {
    const res = response();
    await companyHandler({ db: createDatabase() })(
      request({ body: { company: "현대자동차", jobKeyword: "전략기획", questions: [] } }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("INVALID_REQUEST");
  });

  it("returns 404 when the linked résumé analysis is not owned by the user", async () => {
    const db = createDatabase({ ownedResumeAnalysis: false });
    const res = response();

    await companyHandler({ db })(request({ body: { company: "현대자동차", jobKeyword: "전략기획", resumeAnalysisId: RESUME_ANALYSIS_ID } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("RESUME_ANALYSIS_NOT_FOUND");
    expect(db.analysis.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: RESUME_ANALYSIS_ID, userId: USER_ID, kind: "RESUME" },
    }));
    expect(db.analysisRequest.create).not.toHaveBeenCalled();
  });

  it("returns 503 COMPANY_ANALYSIS_DISABLED while the switch is off", async () => {
    const res = response();
    await companyHandler({ db: createDatabase({ companyAnalysisEnabled: false }) })(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.body.error).toBe("COMPANY_ANALYSIS_DISABLED");
  });

  it("returns 409 COMPANY_CREDITS_EXHAUSTED from the company pool, not the résumé pool", async () => {
    const res = response();
    await companyHandler({
      db: createDatabase(),
      reserveAnalysis: vi.fn(async () => { throw new EntitlementUnavailableError("COMPANY_CREDITS_EXHAUSTED"); }),
    })(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("COMPANY_CREDITS_EXHAUSTED");
  });

  it("accepts the request, reserves a COMPANY credit, and stores an empty-input COMPANY analysis", async () => {
    const db = createDatabase();
    const reserve = vi.fn(async (_tx, _userId, kind) => ({ reservationId: "reservation-1", source: "premium", kind }));
    const model = vi.fn();
    const res = response();

    await companyHandler({ db, model, reserveAnalysis: reserve })(request(), res);

    expect(res.statusCode).toBe(202);
    expect(res.body).toEqual({
      analysis_id: "analysis-1",
      analysis_request_id: "request-1",
      project_id: "project-1",
      requestId: expect.any(String),
      status: "PENDING",
    });
    expect(reserve).toHaveBeenCalledWith(db, USER_ID, "COMPANY");
    expect(db.project.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, title: "현대자동차 전략기획 기업 분석", company: "현대자동차", jobKeyword: "전략기획" },
    });
    expect(db.analysis.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, projectId: "project-1", kind: "COMPANY", questionText: "", inputText: "", totalChars: null, status: "PENDING" },
    });
    const expectedHash = companyRequestHash(normalizeCompanyRequest({ company: "현대자동차", jobKeyword: "전략기획" }));
    expect(db.analysisRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ requestHash: expectedHash, reservationId: "reservation-1" }),
    }));
    expect(model).not.toHaveBeenCalled();
  });

  it("uses the company throughput policy for concurrency and rate limits", async () => {
    const db = createDatabase();
    db.analysisRequest.count = vi.fn(async () => 2);
    const res = response();

    await companyHandler({ db })(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("ANALYSIS_CONCURRENCY_LIMITED");
  });

  it("keeps the résumé handler untouched: no kind query still stores a RESUME analysis", async () => {
    const db = createDatabase();
    const reserve = vi.fn(async (_tx, _userId, kind) => ({ reservationId: "reservation-1", source: "free", kind }));
    const handler = createAnalyzeHandler({
      consumeRateLimit: rateAllowed,
      db,
      enqueueBackgroundWork: () => {},
      getEntitlementSummary: companySummary,
      model: vi.fn(),
      requireUser: activeUser,
      reserveAnalysis: reserve,
    });
    const res = response();

    await handler({
      body: { company: "현대자동차", jobKeyword: "전략기획", questions: [{ question: "지원 동기", answer: "가".repeat(200) }] },
      headers: { "idempotency-key": IDEMPOTENCY_KEY },
      method: "POST",
    }, res);

    expect(res.statusCode).toBe(202);
    expect(reserve).toHaveBeenCalledWith(db, USER_ID, "RESUME");
    expect(db.analysis.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ kind: "RESUME", totalChars: 200 }),
    }));
  });

  it("dispatches ?kind=company from the default export before touching the résumé handler", async () => {
    const res = response();
    await analyzeHandler(request({ headers: {} }), res);
    // 인증이 없으니 401 — 하지만 자소서 본문 검증(questions 필수)이 먼저 돌았다면 400 이었을 것이다.
    expect(res.statusCode).toBe(401);
  });
});
