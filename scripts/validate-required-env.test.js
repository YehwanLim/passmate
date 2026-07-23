import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateRequiredEnvironment } from "./validate-required-env.mjs";

const REQUIRED_ENV = {
  CRON_SECRET: "cron-secret",
  DATABASE_URL: "postgresql://example",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
  SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_ANON_KEY: "anon-key",
  VITE_SUPABASE_URL: "https://example.supabase.co",
};

describe("validateRequiredEnvironment", () => {
  it("rejects a deployment without every server-side credential", () => {
    expect(() => validateRequiredEnvironment({})).toThrow("DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY");
  });

  it("accepts a deployment with all required server-side credentials", () => {
    expect(() => validateRequiredEnvironment(REQUIRED_ENV)).not.toThrow();
  });

  it("runs before the production build", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    );

    expect(packageJson.scripts.prebuild).toBe(
      "node scripts/validate-required-env.mjs"
    );
  });
});
