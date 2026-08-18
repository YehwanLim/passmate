import { describe, expect, it } from "vitest";
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
  it("does not ship beta checkout or purchase-intent code", () => {
    expect(entitlementClientSource).not.toContain("createPurchaseIntent");
    expect(entitlementClientSource).not.toContain("purchase-intents");
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
