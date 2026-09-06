import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

import { fetchProductSettings, updateProductSetting } from "./admin-product-settings";

const mockedFetch = () => vi.mocked(global.fetch);

function jsonResponse(payload: unknown, { ok = true, status = 200 } = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json" },
    status: ok ? status : status || 400,
  });
}

describe("admin product settings API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "session-token" } },
    });
  });

  it("reads the product list with the active Supabase bearer token", async () => {
    const products = [
      { product: "SINGLE", contentId: "6HteWn", paymentUrl: "", active: true, resumeCredits: 1, companyCredits: 0 },
    ];
    mockedFetch().mockResolvedValue(jsonResponse({ products }));

    await expect(fetchProductSettings()).resolves.toEqual(products);
    expect(mockedFetch()).toHaveBeenCalledWith("/api/admin/product-settings", {
      headers: {
        Authorization: "Bearer session-token",
        "Content-Type": "application/json",
      },
    });
  });

  it("patches one product with only the given fields", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ products: [] }));

    await updateProductSetting("PREMIUM", { paymentUrl: "https://www.groble.im/payment/PRM", active: true });

    expect(mockedFetch()).toHaveBeenCalledWith(
      "/api/admin/product-settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ product: "PREMIUM", paymentUrl: "https://www.groble.im/payment/PRM", active: true }),
        headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
      }),
    );
  });

  it("sends null to clear a content id", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ products: [] }));

    await updateProductSetting("STANDARD", { contentId: null });

    expect(mockedFetch()).toHaveBeenCalledWith(
      "/api/admin/product-settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ product: "STANDARD", contentId: null }),
      }),
    );
  });

  it("rejects before requesting when the administrator session is missing", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await expect(fetchProductSettings()).rejects.toThrow(
      "관리자 세션이 만료되었습니다. 다시 로그인해 주세요.",
    );
    expect(mockedFetch()).not.toHaveBeenCalled();
  });

  it("surfaces the server error code", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ error: "DUPLICATE_CONTENT_ID" }, { ok: false, status: 409 }));

    await expect(updateProductSetting("STANDARD", { contentId: "dup" })).rejects.toThrow("DUPLICATE_CONTENT_ID");
  });

  it("rejects a malformed response", async () => {
    mockedFetch().mockResolvedValue(jsonResponse({ products: "nope" }));

    await expect(fetchProductSettings()).rejects.toThrow(
      "결제 상품 설정을 불러오지 못했습니다.",
    );
  });
});
