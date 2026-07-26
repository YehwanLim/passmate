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

  it("deploys only a read-only entitlement summary during beta", () => {
    const config = JSON.parse(read("vercel.json"));
    expect(config.rewrites.some((rewrite) => rewrite.source.includes("entitlements/purchase-intents"))).toBe(false);
    expect(existsSync(`${root}/api/entitlements.js`)).toBe(true);
    expect(read("api/entitlements.js")).not.toContain("createPurchaseIntent");
    expect(read("api/entitlements.js")).not.toContain("groblePaymentUrl: settings");
    expect(existsSync(`${root}/api/webhooks/groble.js`)).toBe(false);
    expect(existsSync(`${root}/client/src/components/PricingSection.tsx`)).toBe(false);
    expect(read("client/src/pages/ReportResult.tsx")).not.toContain("PREMIUM UPSELL");
    expect(read("lib/admin-handlers/entitlements.js")).not.toContain('req.method === "PATCH"');
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

    expect(config.rewrites).toEqual([
      { source: "/((?!api/).*)", destination: "/index.html" },
    ]);
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
});
