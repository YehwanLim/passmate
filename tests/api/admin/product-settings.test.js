import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: { purchaseProductSetting: { findMany: vi.fn(), upsert: vi.fn() } },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { default: handler } = await import("../../../lib/admin-handlers/product-settings.js");

function response() {
  return {
    body: undefined,
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

async function invoke({ body, method = "GET" } = {}) {
  const res = response();
  await handler({ body, headers: { authorization: "Bearer admin-token" }, method, url: "/api/admin/product-settings" }, res);
  return res;
}

const ROWS = [
  { product: "STANDARD", grobleContentId: "4SGBV5", paymentUrl: "https://www.groble.im/payment/4SGBV5", active: true },
  { product: "COMPANY_SINGLE", grobleContentId: null, paymentUrl: "", active: false },
];

// 거부 에러 객체는 tests/api/admin/entitlements.test.js 의 같은 케이스에서 복사한다.
const FORBIDDEN_ERROR_FROM_ENTITLEMENTS_TEST = Object.assign(new Error("forbidden"), { statusCode: 403 });

describe("admin product settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GROBLE_PREMIUM_CONTENT_ID", "4SGBV5");
    vi.stubEnv("GROBLE_SINGLE_CONTENT_ID", "env-single");
    mocks.requireAdministrator.mockResolvedValue({ applicationUser: { id: "11111111-1111-4111-8111-111111111111", role: "admin" } });
    mocks.prisma.purchaseProductSetting.findMany.mockResolvedValue(ROWS);
    mocks.prisma.purchaseProductSetting.upsert.mockResolvedValue({});
  });

  it("lists every product with its settings, credit split, and env fallback content id", async () => {
    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body.products.map((row) => row.product)).toEqual(["SINGLE", "COMPANY_SINGLE", "STANDARD", "PREMIUM", "TRIPLE"]);
    // SINGLE 은 아직 행에 저장된 contentId 가 없어 env fallback 값만 참고용으로 노출한다.
    expect(res.body.products[0]).toEqual({ product: "SINGLE", contentId: null, fallbackContentId: "env-single", paymentUrl: "", active: false, resumeCredits: 1, companyCredits: 0 });
    expect(res.body.products[2]).toEqual({ product: "STANDARD", contentId: "4SGBV5", fallbackContentId: null, paymentUrl: "https://www.groble.im/payment/4SGBV5", active: true, resumeCredits: 2, companyCredits: 1 });
    // 구 3회권 env contentId 는 STANDARD 행이 이미 쓰므로 TRIPLE 에는 붙지 않는다(컷오버 완료 상태).
    expect(res.body.products[4]).toEqual({ product: "TRIPLE", contentId: null, fallbackContentId: null, paymentUrl: "", active: false, resumeCredits: 3, companyCredits: 0 });
  });

  it("upserts one product's settings from a PATCH and returns the refreshed list", async () => {
    const res = await invoke({ method: "PATCH", body: { product: "PREMIUM", contentId: "prm001", paymentUrl: "https://www.groble.im/payment/PRM", active: true } });

    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.purchaseProductSetting.upsert).toHaveBeenCalledWith({
      where: { product: "PREMIUM" },
      create: { product: "PREMIUM", grobleContentId: "prm001", paymentUrl: "https://www.groble.im/payment/PRM", active: true },
      update: { grobleContentId: "prm001", paymentUrl: "https://www.groble.im/payment/PRM", active: true },
    });
    expect(res.body.products).toHaveLength(5);
  });

  it("clears a content id with null and trims whitespace", async () => {
    await invoke({ method: "PATCH", body: { product: "STANDARD", contentId: null, paymentUrl: "  https://www.groble.im/payment/X  " } });

    expect(mocks.prisma.purchaseProductSetting.upsert).toHaveBeenCalledWith({
      where: { product: "STANDARD" },
      create: { product: "STANDARD", grobleContentId: null, paymentUrl: "https://www.groble.im/payment/X" },
      update: { grobleContentId: null, paymentUrl: "https://www.groble.im/payment/X" },
    });
  });

  it("rejects an unknown product, an empty patch, and a non-http payment URL", async () => {
    for (const body of [
      { product: "GOLD", active: true },
      { product: "SINGLE" },
      { product: "SINGLE", paymentUrl: "javascript:alert(1)" },
      { product: "SINGLE", active: "yes" },
      { product: "SINGLE", contentId: "x".repeat(65) },
      { product: "SINGLE", contentId: "   " },
    ]) {
      const res = await invoke({ method: "PATCH", body });
      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "INVALID_PRODUCT_SETTING" });
    }
    expect(mocks.prisma.purchaseProductSetting.upsert).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint clash on the content id to 409", async () => {
    mocks.prisma.purchaseProductSetting.upsert.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));

    const res = await invoke({ method: "PATCH", body: { product: "PREMIUM", contentId: "4SGBV5" } });

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ error: "DUPLICATE_CONTENT_ID" });
  });

  it("refuses non-administrators before touching settings", async () => {
    // 거부 에러 객체는 tests/api/admin/entitlements.test.js 의 같은 케이스에서 복사한다.
    mocks.requireAdministrator.mockRejectedValue(FORBIDDEN_ERROR_FROM_ENTITLEMENTS_TEST);

    const res = await invoke();

    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.purchaseProductSetting.findMany).not.toHaveBeenCalled();
  });

  it("answers other methods with the documented 405", async () => {
    const res = await invoke({ method: "DELETE" });
    expect(res.statusCode).toBe(405);
  });
});
