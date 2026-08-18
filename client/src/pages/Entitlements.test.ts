import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("./Entitlements.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("Entitlements page", () => {
  it("protects the entitlement route and obtains the displayed balance from the API client", () => {
    expect(pageSource).toContain('redirectPath: "/entitlements"');
    expect(pageSource).toContain("supabase.auth.getSession");
    expect(pageSource).toContain("session.access_token");
    expect(pageSource).toContain("fetchEntitlementSummary");
    expect(pageSource).toContain("freeRemaining");
    expect(pageSource).toContain("premiumRemaining");
    expect(pageSource).toContain("remaining");
    expect(appSource).toContain(
      'path={"/entitlements"} component={Entitlements}'
    );
  });

  it("provides retryable errors without exposing beta checkout controls", () => {
    expect(pageSource).toContain("다시 시도");
    expect(pageSource).toContain("현재 추가 이용권 판매를 준비하고 있어요.");
    expect(pageSource).not.toContain("createPurchaseIntent");
    expect(pageSource).not.toContain("window.location.assign");
    expect(pageSource).not.toContain("결제하기");
  });
});
