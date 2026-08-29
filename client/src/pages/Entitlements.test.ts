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

  it("gates the checkout button behind the server-driven sales switch", () => {
    expect(pageSource).toContain("다시 시도");
    // 판매 스위치가 꺼져 있으면 준비 안내만 보인다
    expect(pageSource).toContain("현재 추가 이용권 판매를 준비하고 있어요.");
    expect(pageSource).toContain("summary.premiumEnabled && summary.groblePaymentUrl");
    expect(pageSource).toContain("createPurchaseIntent");
    // 체크아웃은 새 탭으로 연다 — 현재 페이지를 결제 도메인으로 넘기지 않는다
    expect(pageSource).toContain('window.open(intent.checkoutUrl, "_blank", "noopener,noreferrer")');
    expect(pageSource).not.toContain("window.location.assign");
    expect(pageSource).toContain("반영까지 잠시 걸릴 수 있어요");
  });
});
