import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { count: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: usersHandler } = await import("../../../lib/admin-handlers/users.js");

function createResponse() {
  return {
    statusCode: 0,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function userRow(overrides = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    email: "buyer@example.com",
    name: "구매자",
    avatarUrl: null,
    role: "USER",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-09-01T00:00:00Z"),
    _count: { analyses: 4, projects: 2, paymentEntitlements: 2 },
    ...overrides,
  };
}

describe("admin users list — 구매 건수", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({});
    mocks.prisma.$transaction.mockImplementation(async (promises) => {
      // 핸들러가 넘긴 배열은 이미 mock 이 만든 값이라 그대로 돌려준다.
      return Promise.all(promises);
    });
  });

  it("사용자마다 결제 건수를 함께 내려준다", async () => {
    mocks.prisma.user.count.mockResolvedValue(1);
    mocks.prisma.user.findMany.mockResolvedValue([userRow()]);

    const res = createResponse();
    await usersHandler({ method: "GET", query: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.users[0].payment_count).toBe(2);
  });

  it("결제가 없는 사용자는 0 으로 내려준다", async () => {
    mocks.prisma.user.count.mockResolvedValue(1);
    mocks.prisma.user.findMany.mockResolvedValue([
      userRow({ _count: { analyses: 0, projects: 0, paymentEntitlements: 0 } }),
    ]);

    const res = createResponse();
    await usersHandler({ method: "GET", query: {} }, res);

    expect(res.body.users[0].payment_count).toBe(0);
  });
});
