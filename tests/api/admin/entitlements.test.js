import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
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

const { default: entitlementsHandler } = await import("../../../lib/admin-handlers/entitlements.js");

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

async function invoke({ body, method = "GET" } = {}) {
  const res = response();
  await entitlementsHandler(
    {
      body,
      headers: { authorization: "Bearer admin-token" },
      method,
      url: "/api/admin/entitlements",
    },
    res,
  );
  return res;
}

describe("admin premium sales switch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({
      applicationUser: { id: "11111111-1111-4111-8111-111111111111", role: "admin" },
    });
    mocks.prisma.entitlementSetting.findUnique.mockResolvedValue({ premiumEnabled: false });
    mocks.prisma.entitlementSetting.update.mockResolvedValue({ premiumEnabled: true });
  });

  it("reads the current sales state from the database", async () => {
    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ premiumEnabled: false });
  });

  it("turns premium sales on through a single-key PATCH", async () => {
    const res = await invoke({ body: { premiumEnabled: true }, method: "PATCH" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ premiumEnabled: true });
    expect(mocks.prisma.entitlementSetting.update).toHaveBeenCalledWith({
      where: { id: "singleton" },
      data: { premiumEnabled: true },
    });
  });

  it.each([
    [{ premiumEnabled: "true" }],
    [{ premiumEnabled: true, extra: 1 }],
    [{}],
    [undefined],
  ])("rejects a PATCH body that is not exactly { premiumEnabled: boolean }: %j", async (body) => {
    const res = await invoke({ body, method: "PATCH" });

    expect(res.statusCode).toBe(400);
    expect(mocks.prisma.entitlementSetting.update).not.toHaveBeenCalled();
  });

  it("refuses non-administrators before touching settings", async () => {
    mocks.requireAdministrator.mockRejectedValue(
      Object.assign(new Error("forbidden"), { statusCode: 403 }),
    );

    const res = await invoke({ body: { premiumEnabled: true }, method: "PATCH" });

    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.entitlementSetting.update).not.toHaveBeenCalled();
  });
});
