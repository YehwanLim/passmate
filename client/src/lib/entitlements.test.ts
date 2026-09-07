import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  EntitlementApiError,
  fetchEntitlementSummary,
  fetchSalesAvailability,
} from "./entitlements";

const entitlementClientSource = readFileSync(
  new URL("./entitlements.ts", import.meta.url),
  "utf8"
);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("entitlements client", () => {
  it("keeps checkout navigation out of the API client", () => {
    // 체크아웃 URL 은 반환만 하고, 이동은 페이지가 새 탭으로 결정한다
    expect(entitlementClientSource).not.toContain("window.open");
    expect(entitlementClientSource).not.toContain("window.location");
  });

  it("returns the server-provided credit counts without recalculating them", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return jsonResponse({
        premiumEnabled: false,
        freeRemaining: 1,
        premiumRemaining: 0,
        remaining: 1,
        groblePaymentUrl: null,
      });
    };

    await expect(
      fetchEntitlementSummary("access-token", fetcher)
    ).resolves.toEqual({
      premiumEnabled: false,
      freeRemaining: 1,
      // 구버전 서버 응답에 없으면 보너스는 0으로 읽는다
      bonusRemaining: 0,
      premiumRemaining: 0,
      remaining: 1,
      groblePaymentUrl: null,
      // 구버전 서버 응답에 없으면 "미설정"으로 읽는다
      grobleSinglePaymentUrl: null,
      checkoutUrls: { single: null, company: null, standard: null, premium: null, triple: null },
      // 응답에 없으면 "아직 안 받음"으로 읽는다
      feedbackRewardClaimed: false,
      // 구버전 서버 응답에 없으면 기업 분석은 "꺼짐·0"으로 읽는다
      companyAnalysisEnabled: false,
      companyRemaining: 0,
    });
    expect(calls).toEqual([
      [
        "/api/entitlements",
        { headers: { Authorization: "Bearer access-token" } },
      ],
    ]);
  });

  it("rejects malformed credit counts instead of displaying an invented balance", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: false,
        freeRemaining: 1,
        premiumRemaining: 0,
        remaining: "3",
        groblePaymentUrl: null,
      });

    await expect(
      fetchEntitlementSummary("access-token", fetcher)
    ).rejects.toEqual(new EntitlementApiError("Invalid remaining response"));
  });

  it("reads the company analysis pool when the server provides it", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true,
        freeRemaining: 0,
        premiumRemaining: 2,
        remaining: 2,
        groblePaymentUrl: null,
        companyAnalysisEnabled: true,
        companyRemaining: 1,
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).resolves.toMatchObject({
      companyAnalysisEnabled: true,
      companyRemaining: 1,
    });
  });

  it("rejects a malformed company credit count instead of inventing a balance", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: false,
        freeRemaining: 1,
        premiumRemaining: 0,
        remaining: 1,
        groblePaymentUrl: null,
        companyRemaining: "1",
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).rejects.toBeInstanceOf(
      EntitlementApiError
    );
  });

  it("rejects a missing session token before an anonymous request is sent", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("fetch must not run without a session token");
    };

    await expect(fetchEntitlementSummary("", fetcher)).rejects.toEqual(
      new EntitlementApiError("Authentication required")
    );
  });

  it("reads per-product checkout URLs and treats missing keys as closed", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true, freeRemaining: 0, premiumRemaining: 0, remaining: 0,
        groblePaymentUrl: "https://www.groble.im/payment/4SGBV5",
        grobleSinglePaymentUrl: null,
        checkoutUrls: { single: null, standard: "https://www.groble.im/payment/4SGBV5", premium: "https://www.groble.im/payment/PRM" },
      });

    const summary = await fetchEntitlementSummary("access-token", fetcher);
    expect(summary.checkoutUrls).toEqual({
      single: null, company: null, standard: "https://www.groble.im/payment/4SGBV5", premium: "https://www.groble.im/payment/PRM", triple: null,
    });
  });

  it("derives checkout URLs from the legacy fields when an old server omits checkoutUrls", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true, freeRemaining: 0, premiumRemaining: 0, remaining: 0,
        groblePaymentUrl: "https://www.groble.im/payment/4SGBV5",
        grobleSinglePaymentUrl: "https://www.groble.im/payment/6HteWn",
      });

    const summary = await fetchEntitlementSummary("access-token", fetcher);
    expect(summary.checkoutUrls.standard).toBe("https://www.groble.im/payment/4SGBV5");
    expect(summary.checkoutUrls.single).toBe("https://www.groble.im/payment/6HteWn");
    expect(summary.checkoutUrls.premium).toBeNull();
  });

  it("rejects a malformed checkout URL instead of rendering a broken button", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true, freeRemaining: 0, premiumRemaining: 0, remaining: 0,
        groblePaymentUrl: null, checkoutUrls: { premium: 42 },
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).rejects.toEqual(
      new EntitlementApiError("Invalid checkoutUrls.premium response"),
    );
  });
});

describe("createPurchaseIntent", () => {
  it("posts to the purchase-intents route and returns the stamped checkout URL", async () => {
    const { createPurchaseIntent } = await import("./entitlements");
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          purchaseIntentId: "33333333-3333-4333-8333-333333333333",
          checkoutUrl:
            "https://www.groble.im/payment/4SGBV5?ref=33333333-3333-4333-8333-333333333333",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    const intent = await createPurchaseIntent(
      "token",
      "triple",
      fetcher as typeof fetch
    );

    expect(fetcher).toHaveBeenCalledWith(
      "/api/entitlements/purchase-intents?product=triple",
      {
        method: "POST",
        headers: { Authorization: "Bearer token" },
      }
    );
    expect(intent.checkoutUrl).toContain("ref=33333333");
  });

  it("stamps the requested product onto the purchase-intent query string", async () => {
    const { createPurchaseIntent } = await import("./entitlements");
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          purchaseIntentId: "33333333-3333-4333-8333-333333333333",
          checkoutUrl: "https://www.groble.im/payment/SINGLE?ref=33333333-3333-4333-8333-333333333333",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createPurchaseIntent("token", "single", fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/entitlements/purchase-intents?product=single",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("stamps the premium product onto the purchase-intent query string", async () => {
    const { createPurchaseIntent } = await import("./entitlements");
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          purchaseIntentId: "33333333-3333-4333-8333-333333333333",
          checkoutUrl: "https://www.groble.im/payment/PRM?ref=33333333-3333-4333-8333-333333333333",
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );

    await createPurchaseIntent("token", "premium", fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/entitlements/purchase-intents?product=premium",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces the server error code when sales are disabled", async () => {
    const { createPurchaseIntent } = await import("./entitlements");
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "PREMIUM_SALES_DISABLED" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createPurchaseIntent("token", "triple", fetcher as typeof fetch),
    ).rejects.toThrow("PREMIUM_SALES_DISABLED");
  });
});

describe("fetchSalesAvailability", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads booleans tolerantly and treats unknown keys as closed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      companyAnalysisEnabled: true,
      purchasable: { single: true, standard: "yes", premium: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const availability = await fetchSalesAvailability();
    expect(fetch).toHaveBeenCalledWith("/api/entitlements?availability=1");
    expect(availability).toEqual({
      companyAnalysisEnabled: true,
      purchasable: { single: true, company: false, standard: false, premium: false, triple: false },
    });
  });

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    await expect(fetchSalesAvailability()).rejects.toThrow();
  });
});
