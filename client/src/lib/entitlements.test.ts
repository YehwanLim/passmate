import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  EntitlementApiError,
  fetchEntitlementSummary,
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
      premiumRemaining: 0,
      remaining: 1,
      groblePaymentUrl: null,
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

  it("rejects a missing session token before an anonymous request is sent", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("fetch must not run without a session token");
    };

    await expect(fetchEntitlementSummary("", fetcher)).rejects.toEqual(
      new EntitlementApiError("Authentication required")
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

    const intent = await createPurchaseIntent("token", fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith("/api/entitlements/purchase-intents", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    });
    expect(intent.checkoutUrl).toContain("ref=33333333");
  });

  it("surfaces the server error code when sales are disabled", async () => {
    const { createPurchaseIntent } = await import("./entitlements");
    const fetcher = vi.fn(async () =>
      new Response(JSON.stringify({ error: "PREMIUM_SALES_DISABLED" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(createPurchaseIntent("token", fetcher as typeof fetch)).rejects.toThrow(
      "PREMIUM_SALES_DISABLED",
    );
  });
});
