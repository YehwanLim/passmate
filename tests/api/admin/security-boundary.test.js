import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeUserRateLimit: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    analysis: { count: vi.fn(), findMany: vi.fn() },
    entitlementSetting: { findUnique: vi.fn(), update: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

vi.mock("../../../lib/rate-limit.js", () => ({
  USER_RATE_LIMITS: { adminModelTest: { limit: 3 } },
  consumeUserRateLimit: mocks.consumeUserRateLimit,
}));

vi.mock("../../../lib/ai-model-settings.js", () => ({
  readAiModelSettings: vi.fn(() => ({})),
  writeAiModelSettings: vi.fn(() => ({})),
}));

const { default: aiModelsHandler } = await import("../../../lib/admin-handlers/ai-models.js");
const { default: entitlementsHandler } = await import("../../../lib/admin-handlers/entitlements.js");
const { default: resumeAnalysisHandler } = await import("../../../lib/admin-handlers/resume-analysis.js");

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

async function invoke(handler, { body, method = "GET", query = {} } = {}) {
  const res = response();
  await handler(
    {
      body,
      headers: { authorization: "Bearer test-token" },
      method,
      query,
      url: "/api/admin/test",
    },
    res,
  );
  return res;
}

function authorizationError(statusCode) {
  return Object.assign(new Error("authentication internals"), { statusCode });
}

const ADMINISTRATOR = {
  applicationUser: { id: "11111111-1111-4111-8111-111111111111", role: "admin" },
  authenticatedUser: { id: "11111111-1111-4111-8111-111111111111" },
};

describe.each([
  ["AI model configuration", aiModelsHandler],
  ["analysis list", resumeAnalysisHandler],
  ["entitlements", entitlementsHandler],
])("admin %s handler", (_name, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.$transaction.mockResolvedValue([0, [], []]);
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: false });
  });

  it("returns 401 for an unauthenticated request", async () => {
    mocks.requireAdministrator.mockRejectedValue(authorizationError(401));

    const res = await invoke(handler);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Request failed", requestId: expect.any(String) });
  });

  it("returns 403 for an authenticated member", async () => {
    mocks.requireAdministrator.mockRejectedValue(authorizationError(403));

    const res = await invoke(handler);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Request failed", requestId: expect.any(String) });
  });

  it("allows an administrator", async () => {
    mocks.requireAdministrator.mockResolvedValue(ADMINISTRATOR);

    const res = await invoke(handler);

    expect(res.statusCode).toBe(200);
    expect(mocks.requireAdministrator).toHaveBeenCalledWith(
      expect.any(Object),
      mocks.prisma,
    );
  });
});

describe("administrator model test action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPEN_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.requireAdministrator.mockResolvedValue(ADMINISTRATOR);
    mocks.consumeUserRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  });

  it("does not invoke a provider or limiter when GET loads model metadata", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider must not be called"));

    const res = await invoke(aiModelsHandler);

    expect(res.statusCode).toBe(200);
    expect(mocks.consumeUserRateLimit).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects a provider test before the limiter when the model is outside the allowlist", async () => {
    const res = await invoke(aiModelsHandler, {
      body: { action: "test-model", modelName: "unapproved-model", providerKey: "openai" },
      method: "POST",
    });

    expect(res.statusCode).toBe(400);
    expect(mocks.consumeUserRateLimit).not.toHaveBeenCalled();
  });

  it("applies the per-administrator rate limiter before an allowed provider test", async () => {
    const res = await invoke(aiModelsHandler, {
      body: { action: "test-model", modelName: "gpt-5.4-nano", providerKey: "openai" },
      method: "POST",
    });

    expect(res.statusCode).toBe(200);
    expect(mocks.consumeUserRateLimit).toHaveBeenCalledWith(mocks.prisma, {
      policy: { limit: 3 },
      userId: ADMINISTRATOR.applicationUser.id,
    });
  });

  it("does not call a provider when the rate limit denies the test", async () => {
    mocks.consumeUserRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 3600 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("provider must not be called"));

    const res = await invoke(aiModelsHandler, {
      body: { action: "test-model", modelName: "gpt-5.4-nano", providerKey: "openai" },
      method: "POST",
    });

    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ error: "Request failed", retryAfterSeconds: 3600 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
