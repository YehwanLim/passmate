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
    expect(pageSource).toContain("자소서 분석");
    expect(pageSource).toContain("freeRemaining");
    // 합계(remaining)에 포함되는 보너스 크레딧이 화면에서 빠지면 숫자가 안 맞는다.
    expect(pageSource).toContain("summary.bonusRemaining");
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

  it("offers a direct entry into analysis from the balance page", () => {
    expect(pageSource).toContain('navigate("/analyze")');
    expect(pageSource).toContain("자소서 분석하기");
    // 기업 분석 진입은 판매 스위치와 잔여 크레딧이 모두 있을 때만 노출한다.
    expect(pageSource).toContain('navigate("/company-analysis")');
    expect(pageSource).toContain("hasCompanyCredit");
  });

  it("promotes purchasing only when no credit is left", () => {
    expect(pageSource).toContain("hasEssayCredit ? PRIMARY_ACTION_CLASS");
    expect(pageSource).toContain(
      "summary && !hasEssayCredit && !hasCompanyCredit"
    );
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
