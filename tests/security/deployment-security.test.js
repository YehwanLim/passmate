import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("beta deployment security configuration", () => {
  it("ships the required browser security headers", () => {
    const config = JSON.parse(read("vercel.json"));
    const headers = Object.fromEntries(
      config.headers.flatMap((entry) => entry.headers.map((header) => [header.key, header.value])),
    );

    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).not.toContain("img-src 'self' data: https:;");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("camera=()");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("keeps the payment pipeline inside the entitlements function with safe defaults", () => {
    // 12함수 한도: 웹훅은 전용 api 파일이 아니라 rewrite 로 entitlements 에 합류한다.
    expect(existsSync(`${root}/api/webhooks/groble.js`)).toBe(false);
    expect(existsSync(`${root}/api/entitlements.js`)).toBe(true);

    const entitlements = read("api/entitlements.js");
    // 웹훅 서명 검증은 원문이 필요하므로 bodyParser 를 끈 상태를 유지해야 한다.
    expect(entitlements).toContain("bodyParser: false");
    // 구매 의도는 판매 스위치가 꺼져 있으면 거부되어야 한다.
    expect(entitlements).toContain("PREMIUM_SALES_DISABLED");

    const config = JSON.parse(read("vercel.json"));
    expect(config.rewrites).toContainEqual({
      source: "/api/webhooks/groble",
      destination: "/api/entitlements?grobleWebhook=1",
    });
    expect(config.rewrites).toContainEqual({
      source: "/api/entitlements/purchase-intents",
      destination: "/api/entitlements?purchaseIntent=1",
    });

    // 리포트 화면의 업셀 문구는 여전히 금지 (전환 루프는 별도 과제)
    expect(read("client/src/pages/ReportResult.tsx")).not.toContain("PREMIUM UPSELL");
  });

  it("does not deploy administrator credit grants or coupon management during beta", () => {
    expect(existsSync(`${root}/api/admin/credit-management.js`)).toBe(false);
    expect(existsSync(`${root}/client/src/lib/admin-credits.ts`)).toBe(false);
    expect(read("client/src/pages/admin/users/UsersPage.tsx")).not.toContain("무료 이용권 쿠폰 관리");
    expect(read("client/src/pages/admin/users/UserDetailPage.tsx")).not.toContain("UserCreditManagementCard");
  });

  it("removes diagnostic AI routes and routes local runtimes through the secured analysis handler", () => {
    const viteConfig = read("vite.config.ts");
    const expressServer = read("server/index.ts");

    expect(viteConfig).not.toContain("/api/test-gemini");
    expect(viteConfig).not.toContain("manus-debug-collector");
    expect(viteConfig).not.toContain("sessionReplay");
    expect(existsSync(`${root}/client/public/__manus__/debug-collector.js`)).toBe(false);
    expect(existsSync(`${root}/data/ai-model-settings.json`)).toBe(false);
    expect(expressServer).not.toContain("/api/test-gemini");
    expect(viteConfig).not.toContain("./server/api/analyze");
    expect(expressServer).toContain("../api/analyze.js");
    expect(expressServer).not.toContain("analyzeCoverLetter");
  });

  it("runs the protected account-purge job daily", () => {
    const config = JSON.parse(read("vercel.json"));

    expect(config.crons).toContainEqual({
      path: "/api/cron/purge-deleted-users",
      schedule: "0 3 * * *",
    });
  });

  it("keeps API requests out of the SPA fallback rewrite", () => {
    const config = JSON.parse(read("vercel.json"));

    // 다중 세그먼트 API 경로(관리자 상세, 계정 삭제 취소)는 catch-all 함수로 명시
    // rewrite 해야 한다. Vercel의 파일 기반 라우팅은 `[...route].js`에 단일 세그먼트만
    // 매칭시켜, rewrite가 없으면 배포에서만 404가 났다 (2026-08-27 실배포에서 확인).
    expect(config.rewrites).toEqual([
      { source: "/api/admin/:path*", destination: "/api/admin/[...route]?route=:path*" },
      { source: "/api/account/:path*", destination: "/api/account/[...route]?route=:path*" },
      { source: "/api/webhooks/groble", destination: "/api/entitlements?grobleWebhook=1" },
      { source: "/api/entitlements/purchase-intents", destination: "/api/entitlements?purchaseIntent=1" },
      { source: "/((?!api/).*)", destination: "/index.html" },
    ]);

    // API rewrite가 SPA fallback보다 먼저 와야 한다. fallback의 부정 lookahead가
    // /api/ 를 걸러내긴 하지만, 순서까지 고정해 회귀를 막는다.
    const fallbackIndex = config.rewrites.findIndex(
      (rule) => rule.destination === "/index.html",
    );
    expect(fallbackIndex).toBe(config.rewrites.length - 1);
  });

  it("reserves a bounded background window for the analysis function only", () => {
    const config = JSON.parse(read("vercel.json"));

    expect(config.functions).toEqual({
      "api/analyze.js": { maxDuration: 120 },
    });
  });

  it("keeps analysis request status behind the authenticated server boundary", () => {
    const source = read("api/analysis-requests/[id].js");

    expect(source).toContain("requireActiveApplicationUser");
    expect(source).toContain("userId: applicationUser.id");
    expect(source).not.toContain("Access-Control-Allow-Origin");
  });

  it("backfills existing OAuth users before client profile writes are removed", () => {
    const migration = read("prisma/migrations/20260723_backfill_auth_users/migration.sql");

    expect(migration).toContain("INSERT INTO public.users");
    expect(migration).toContain("FROM auth.users");
    expect(migration).toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("stages provider results and repairs incompatible pending rows before release", () => {
    const migration = read("prisma/migrations/20260723_stage_provider_results/migration.sql");

    expect(migration).toContain("provider_result JSONB");
    expect(migration).toContain("provider_metadata JSONB");
    expect(migration).toContain("idx_analysis_requests_user_hash_status");
    expect(migration).toContain("status = 'PERSISTENCE_PENDING'");
    expect(migration).toContain("status = 'CONSUMED'");
    expect(migration).toContain("error_code = 'API_ERROR'");
    expect(migration).toContain("RECONCILIATION_CONSUMED");
  });

  it("applies the analysis request status migrations in a fresh-database-safe order", () => {
    const stateMigration = read("prisma/migrations/20260723_add_analysis_request_processing_states/migration.sql");
    const primitiveMigration = read("prisma/migrations/20260723_add_security_primitives/migration.sql");

    expect(stateMigration).toContain("IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'analysis_request_status')");
    expect(primitiveMigration).toContain("'PENDING', 'CALLING', 'PERSISTENCE_PENDING', 'SUCCEEDED', 'FAILED'");
  });

  it("keeps browser authoring tools out of the production bundle", async () => {
    const { default: viteConfig } = await import("../../vite.config.ts");
    const plugins = viteConfig.plugins.flat(Infinity).filter(Boolean);
    const byName = (name) => plugins.find((plugin) => plugin?.name === name);

    // Both inject themselves into the page: the Manus runtime is a DOM
    // inspection and screenshot overlay, and the JSX plugin stamps source file
    // paths onto rendered elements. Neither may run outside `vite dev`.
    expect(byName("vite-plugin-manus-runtime")?.apply).toBe("serve");
    expect(byName("vite-plugin-jsx-loc")?.apply).toBe("serve");
  });
});
