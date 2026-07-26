import { beforeEach, describe, expect, it, vi } from "vitest";

const COUPON_ID = "33333333-3333-4333-8333-333333333333";
const mocks = vi.hoisted(() => ({
  prisma: {
    creditCoupon: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/admin-auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { default: handler } = await import("../../../api/admin/credit-management.js");

function createResponse() {
  return { body: undefined, statusCode: 200, json(payload) { this.body = payload; return this; }, status(statusCode) { this.statusCode = statusCode; return this; } };
}

async function invokeCoupons({ body, method = "GET" } = {}) {
  const response = createResponse();
  await handler({
    body,
    headers: {},
    method,
    url: "/api/admin/credit-management?creditResource=credit-coupons",
  }, response);
  return response;
}

describe("admin credit coupon API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
    mocks.prisma.creditCoupon.create.mockResolvedValue({ id: COUPON_ID, code: "WELCOME_2", creditsGranted: 2, maxUses: null, usedCount: 0, isActive: true, expiresAt: null });
    mocks.prisma.creditCoupon.findMany.mockResolvedValue([]);
    mocks.prisma.creditCoupon.findUnique.mockResolvedValue({ id: COUPON_ID, usedCount: 0 });
    mocks.prisma.creditCoupon.update.mockResolvedValue({ id: COUPON_ID, creditsGranted: 3, isActive: true, maxUses: null, expiresAt: null });
    mocks.prisma.creditCoupon.updateMany.mockResolvedValue({ count: 1 });
  });

  it("normalizes a valid new coupon and creates it", async () => {
    const response = await invokeCoupons({ method: "POST", body: { code: " welcome_2 ", creditsGranted: 2 } });
    expect(response.statusCode).toBe(201);
    expect(mocks.prisma.creditCoupon.create).toHaveBeenCalledWith({
      data: {
        code: "WELCOME_2",
        creditsGranted: 2,
        maxUses: null,
        expiresAt: null,
        isActive: true,
      },
    });
  });

  it("creates an initially inactive coupon atomically", async () => {
    const response = await invokeCoupons({
      method: "POST",
      body: { code: "WELCOME_2", creditsGranted: 2, isActive: false },
    });

    expect(response.statusCode).toBe(201);
    expect(mocks.prisma.creditCoupon.create).toHaveBeenCalledOnce();
    expect(mocks.prisma.creditCoupon.create).toHaveBeenCalledWith({
      data: {
        code: "WELCOME_2",
        creditsGranted: 2,
        maxUses: null,
        expiresAt: null,
        isActive: false,
      },
    });
    expect(mocks.prisma.creditCoupon.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid coupon lifecycle payload without creating a coupon", async () => {
    const response = await invokeCoupons({ method: "POST", body: { code: "bad code", creditsGranted: 0 } });
    expect(response.statusCode).toBe(400);
    expect(mocks.prisma.creditCoupon.create).not.toHaveBeenCalled();
  });

  it("rejects changing credits after a coupon has been used", async () => {
    mocks.prisma.creditCoupon.findUnique.mockResolvedValue({ id: COUPON_ID, usedCount: 1 });
    const response = await invokeCoupons({ method: "PATCH", body: { id: COUPON_ID, creditsGranted: 3 } });
    expect(response.statusCode).toBe(400);
    expect(mocks.prisma.creditCoupon.update).not.toHaveBeenCalled();
  });

  it("rejects a credit change when redemption wins the concurrent update", async () => {
    let usedCount = 0;
    mocks.prisma.creditCoupon.findUnique.mockImplementation(async () => ({
      id: COUPON_ID,
      usedCount,
      creditsGranted: 2,
      isActive: true,
      maxUses: null,
      expiresAt: null,
    }));
    mocks.prisma.creditCoupon.updateMany.mockImplementation(async ({ where }) => {
      usedCount = 1;
      return { count: where.usedCount === 0 && usedCount === 0 ? 1 : 0 };
    });

    const response = await invokeCoupons({
      method: "PATCH",
      body: { id: COUPON_ID, creditsGranted: 3 },
    });

    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: "Cannot change credits after coupon use" },
    });
    expect(mocks.prisma.creditCoupon.updateMany).toHaveBeenCalledWith({
      where: { id: COUPON_ID, usedCount: 0 },
      data: { creditsGranted: 3 },
    });
    expect(mocks.prisma.creditCoupon.update).not.toHaveBeenCalled();
  });

  it("rejects lowering max uses below the current redemption count", async () => {
    mocks.prisma.creditCoupon.findUnique.mockResolvedValue({
      id: COUPON_ID,
      usedCount: 2,
    });

    const response = await invokeCoupons({
      method: "PATCH",
      body: { id: COUPON_ID, maxUses: 1 },
    });

    expect(response).toMatchObject({
      statusCode: 400,
      body: { error: "Cannot set max uses below current usage" },
    });
    expect(mocks.prisma.creditCoupon.updateMany).not.toHaveBeenCalled();
    expect(mocks.prisma.creditCoupon.update).not.toHaveBeenCalled();
  });

  it("rejects invalid lifecycle updates before loading the coupon", async () => {
    const response = await invokeCoupons({ method: "PATCH", body: { id: COUPON_ID, creditsGranted: null } });
    expect(response.statusCode).toBe(400);
    expect(mocks.prisma.creditCoupon.findUnique).not.toHaveBeenCalled();
  });

  it("rejects impossible ISO expiration dates before creating a coupon", async () => {
    const response = await invokeCoupons({ method: "POST", body: { code: "WELCOME_2", creditsGranted: 2, expiresAt: "2026-02-30" } });
    expect(response.statusCode).toBe(400);
    expect(mocks.prisma.creditCoupon.create).not.toHaveBeenCalled();
  });

  it("maps a duplicate coupon code collision to 409", async () => {
    mocks.prisma.creditCoupon.create.mockRejectedValue({ code: "P2002" });
    const response = await invokeCoupons({ method: "POST", body: { code: "WELCOME_2", creditsGranted: 2 } });
    expect(response).toMatchObject({ statusCode: 409, body: { error: "COUPON_CODE_EXISTS" } });
  });
});
