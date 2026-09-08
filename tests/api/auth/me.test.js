import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveApplicationUser: vi.fn(),
  requireAuthenticatedUser: vi.fn(),
  prisma: { siteVisit: { create: vi.fn() } },
}));

vi.mock("../../../lib/auth.js", () => ({
  requireActiveApplicationUser: mocks.requireActiveApplicationUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: meHandler } = await import("../../../api/auth/me.js");

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader() {},
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

async function invoke({ method = "GET" } = {}) {
  const res = response();
  await meHandler({ headers: { authorization: "Bearer test-token" }, method }, res);
  return res;
}

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only active user identity and role", async () => {
    mocks.requireActiveApplicationUser.mockResolvedValue({
      applicationUser: {
        id: "11111111-1111-4111-8111-111111111111",
        role: "admin",
        deletionRequestedAt: null,
      },
      authenticatedUser: {
        email: "admin@example.test",
        id: "11111111-1111-4111-8111-111111111111",
      },
    });

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      role: "admin",
      deletionPending: false,
    });
  });

  it("returns an opaque request-ID error when active authentication fails", async () => {
    mocks.requireActiveApplicationUser.mockRejectedValue(
      Object.assign(new Error("database details must stay private"), { statusCode: 401 }),
    );

    const res = await invoke();

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "Request failed",
      requestId: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toContain("database details");
  });

  it("dispatches ?visit=1 to the anonymous visit ping without requiring an active user", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(null);
    mocks.prisma.siteVisit.create.mockResolvedValue({ id: "visit-1" });
    const res = response();

    await meHandler(
      {
        headers: {},
        method: "POST",
        query: { visit: "1" },
        body: { visitorId: "8c4d2a70-3b1e-4d5f-9a6b-2c1d0e9f8a7b", path: "/" },
      },
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ recorded: true });
    expect(mocks.requireActiveApplicationUser).not.toHaveBeenCalled();
    expect(mocks.prisma.siteVisit.create).toHaveBeenCalledTimes(1);
  });
});
