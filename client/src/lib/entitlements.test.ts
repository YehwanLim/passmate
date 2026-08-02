import { describe, expect, it } from "vitest";
import {
  EntitlementApiError,
  canPurchaseEntitlement,
  createPurchaseIntent,
  fetchEntitlementSummary,
} from "./entitlements";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("entitlements client", () => {
  it("returns the server-provided credit counts without recalculating them", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return jsonResponse({
        premiumEnabled: true,
        freeRemaining: 1,
        premiumRemaining: 2,
        remaining: 3,
        groblePaymentUrl: "https://www.groble.im/payment/example",
      });
    };

    await expect(fetchEntitlementSummary("access-token", fetcher)).resolves.toEqual({
      premiumEnabled: true,
      freeRemaining: 1,
      premiumRemaining: 2,
      remaining: 3,
      groblePaymentUrl: "https://www.groble.im/payment/example",
    });
    expect(calls).toEqual([
      ["/api/entitlements", { headers: { Authorization: "Bearer access-token" } }],
    ]);
  });

  it("makes checkout available only for an enabled and configured product", () => {
    expect(
      canPurchaseEntitlement({
        premiumEnabled: true,
        freeRemaining: 0,
        premiumRemaining: 0,
        remaining: 0,
        groblePaymentUrl: "https://www.groble.im/payment/example",
      }),
    ).toBe(true);
    expect(
      canPurchaseEntitlement({
        premiumEnabled: false,
        freeRemaining: 0,
        premiumRemaining: 0,
        remaining: 0,
        groblePaymentUrl: "https://www.groble.im/payment/example",
      }),
    ).toBe(false);
  });

  it("creates a purchase intent before returning the checkout URL", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return jsonResponse(
        {
          purchaseIntentId: "purchase-intent-1",
          checkoutUrl: "https://www.groble.im/payment/example",
        },
        201,
      );
    };

    await expect(createPurchaseIntent("access-token", fetcher)).resolves.toEqual({
      purchaseIntentId: "purchase-intent-1",
      checkoutUrl: "https://www.groble.im/payment/example",
    });
    expect(calls).toEqual([
      [
        "/api/entitlements/purchase-intents",
        { method: "POST", headers: { Authorization: "Bearer access-token" } },
      ],
    ]);
  });

  it("reports a failed entitlement request as an actionable API error", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({ error: "PREMIUM_SALES_DISABLED" }, 403);

    await expect(createPurchaseIntent("access-token", fetcher)).rejects.toEqual(
      new EntitlementApiError("PREMIUM_SALES_DISABLED"),
    );
  });

  it("rejects malformed credit counts instead of displaying an invented balance", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse({
        premiumEnabled: true,
        freeRemaining: 1,
        premiumRemaining: 2,
        remaining: "3",
        groblePaymentUrl: null,
      });

    await expect(fetchEntitlementSummary("access-token", fetcher)).rejects.toEqual(
      new EntitlementApiError("Invalid remaining response"),
    );
  });

  it("rejects an insecure checkout URL before redirecting to payment", async () => {
    const fetcher: typeof fetch = async () =>
      jsonResponse(
        {
          purchaseIntentId: "purchase-intent-1",
          checkoutUrl: "http://www.groble.im/payment/example",
        },
        201,
      );

    await expect(createPurchaseIntent("access-token", fetcher)).rejects.toEqual(
      new EntitlementApiError("Invalid checkoutUrl response"),
    );
  });

  it("rejects a missing session token before an anonymous request is sent", async () => {
    const fetcher: typeof fetch = async () => {
      throw new Error("fetch must not run without a session token");
    };

    await expect(fetchEntitlementSummary("", fetcher)).rejects.toEqual(
      new EntitlementApiError("Authentication required"),
    );
  });
});
