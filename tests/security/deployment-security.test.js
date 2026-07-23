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
});
