import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./Entitlements.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("Entitlements page", () => {
  it("protects the entitlement route and obtains the displayed balance from the API client", () => {
    expect(pageSource).toContain('useRequireAuth({ redirectPath: "/entitlements" })');
    expect(pageSource).toContain("supabase.auth.getSession");
    expect(pageSource).toContain("session.access_token");
    expect(pageSource).toContain("fetchEntitlementSummary");
    expect(pageSource).toContain("freeRemaining");
    expect(pageSource).toContain("premiumRemaining");
    expect(pageSource).toContain("remaining");
    expect(appSource).toContain('path={"/entitlements"} component={Entitlements}');
  });

  it("provides retryable errors and only starts checkout after a purchase intent", () => {
    expect(pageSource).toContain("다시 시도");
    expect(pageSource).toContain("canPurchaseEntitlement");
    expect(pageSource).toContain("createPurchaseIntent");
    expect(pageSource).toContain("window.location.assign");
    expect(pageSource).toContain("결제하기");
  });

  it("makes the checkout action visually distinct without enlarging the entitlement rows", () => {
    expect(pageSource).toContain(
      "rounded-md bg-white px-3 text-xs font-semibold text-black",
    );
  });

  it("uses compact entitlement rows instead of oversized summary cards", () => {
    expect(pageSource).toContain('className="text-2xl font-bold text-zinc-100 tracking-tight mb-1"');
    expect(pageSource).toContain("현재 보유한 분석 이용권을 간단히 확인할 수 있어요.");
    expect(pageSource).toContain('className="border-y border-white/5"');
    expect(pageSource).toContain("text-xl font-semibold");
    expect(pageSource).toContain("function CreditSummaryRow");
    expect(pageSource).not.toContain("function CreditSummaryCard");
    expect(pageSource).not.toContain("text-3xl font-semibold");
    expect(pageSource).not.toContain("text-5xl font-bold");
    expect(pageSource).not.toContain("bg-gradient-to-br from-violet-500");
  });
});
