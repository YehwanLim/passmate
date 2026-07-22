import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateRequiredEnvironment } from "./validate-required-env.mjs";

describe("validateRequiredEnvironment", () => {
  it("rejects a deployment without DATABASE_URL", () => {
    expect(() => validateRequiredEnvironment({})).toThrow("DATABASE_URL");
  });

  it("accepts a deployment with DATABASE_URL", () => {
    expect(() =>
      validateRequiredEnvironment({ DATABASE_URL: "postgresql://example" })
    ).not.toThrow();
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
