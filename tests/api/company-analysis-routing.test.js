import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));

describe("company analysis routing", () => {
  it("maps /api/analyze/company to the analyze function with kind=company in Vite", () => {
    expect(viteSource).toContain('if (pathname === "/api/analyze/company")');
    expect(viteSource).toContain('return { file: "api/analyze.js", query: { kind: "company" } }');
  });

  it("rewrites /api/analyze/company to ?kind=company on Vercel before the SPA fallback", () => {
    const rewrites = vercelConfig.rewrites;
    const companyIndex = rewrites.findIndex((rule) => rule.source === "/api/analyze/company");
    const fallbackIndex = rewrites.findIndex((rule) => rule.destination === "/index.html");
    expect(companyIndex).toBeGreaterThan(-1);
    expect(rewrites[companyIndex].destination).toBe("/api/analyze?kind=company");
    expect(companyIndex).toBeLessThan(fallbackIndex);
  });
});
