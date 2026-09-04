import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  new URL("./MyEntitlements.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("MyEntitlements page", () => {
  it("requires sign-in before showing the account balance", () => {
    expect(pageSource).toContain("useRequireAuth({");
    expect(pageSource).toContain('redirectPath: "/my/entitlements"');
  });

  it("obtains the displayed balance from the API client", () => {
    expect(pageSource).toContain("supabase.auth.getSession");
    expect(pageSource).toContain("session.access_token");
    expect(pageSource).toContain("fetchEntitlementSummary");
    expect(pageSource).toContain("남은 분석");
    expect(pageSource).toContain("freeRemaining");
    expect(pageSource).toContain("premiumRemaining");
    expect(pageSource).toContain("summary.remaining");
    // 로드 실패 시 복구 수단이 있어야 한다.
    expect(pageSource).toContain("다시 시도");
  });

  it("links to the purchase page instead of rendering pricing cards", () => {
    expect(pageSource).toContain('navigate("/entitlements")');
    expect(pageSource).not.toContain("renderPaidPlanCard");
    expect(pageSource).not.toContain("createPurchaseIntent");
  });

  it("registers the route before the /my/:projectId catch-all", () => {
    const entitlementsRouteIndex = appSource.indexOf(
      'path={"/my/entitlements"} component={MyEntitlements}'
    );
    const projectRouteIndex = appSource.indexOf('path={"/my/:projectId"}');

    expect(entitlementsRouteIndex).toBeGreaterThan(-1);
    expect(projectRouteIndex).toBeGreaterThan(entitlementsRouteIndex);
  });
});
