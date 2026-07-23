import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveApplicationUser: vi.fn(),
  prisma: {},
}));

vi.mock("../../../lib/auth.js", () => ({
  requireActiveApplicationUser: mocks.requireActiveApplicationUser,
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
});
