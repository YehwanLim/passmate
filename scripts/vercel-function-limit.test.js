import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const API_ROOT = join(process.cwd(), "api");
const VERCEL_CONFIG = JSON.parse(
  readFileSync(join(process.cwd(), "vercel.json"), "utf8"),
);
const VITE_CONFIG = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

function collectFunctionFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectFunctionFiles(path);
    }
    return entry.name.endsWith(".js") && !entry.name.endsWith(".test.js")
      ? [relative(API_ROOT, path)]
      : [];
  });
}

describe("Vercel Hobby serverless function limit", () => {
  it("keeps deployed API files within the 12-function Hobby limit", () => {
    const apiFiles = collectFunctionFiles(API_ROOT);

    expect(apiFiles.length).toBeLessThanOrEqual(12);
    expect(apiFiles).toContain("admin/credit-management.js");
    expect(apiFiles).not.toContain("admin/user-credits.js");
    expect(apiFiles).not.toContain("admin/credit-coupons.js");
  });

  it("routes both public credit APIs to the shared deployed function", () => {
    expect(VERCEL_CONFIG.rewrites).toEqual(expect.arrayContaining([
      {
        source: "/api/admin/user-credits",
        destination: "/api/admin/credit-management?creditResource=user-credits",
      },
      {
        source: "/api/admin/credit-coupons",
        destination: "/api/admin/credit-management?creditResource=credit-coupons",
      },
    ]));
    expect(VITE_CONFIG).toContain(
      'registerAdminCreditHandler("/api/admin/user-credits", "user-credits")',
    );
    expect(VITE_CONFIG).toContain(
      'registerAdminCreditHandler("/api/admin/credit-coupons", "credit-coupons")',
    );
    expect(VITE_CONFIG).toContain(
      'path.join(PROJECT_ROOT, "api", "admin", "credit-management.js")',
    );
  });
});
