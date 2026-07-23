import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const hook = readFileSync(new URL("../../../hooks/admin/useAnalysesData.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../../../../../lib/admin-handlers/resume-analysis.js", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../../../../../vite.config.ts", import.meta.url), "utf8");

describe("admin resume analysis persistence", () => {
  it("loads admin rows from the server API that reads persisted analyses", () => {
    expect(hook).toContain("/api/admin/resume-analysis?");
    expect(hook).toContain("adminApiFetch");
    expect(hook).not.toContain("window.fetch");
    expect(hook).not.toContain('.from("analyses")');
    expect(api).toContain("prisma.analysis.findMany");
    expect(api).toContain("user: { select: { email: true, name: true } }");
    expect(api).toContain("project: { select: { title: true, company: true, jobKeyword: true } }");
    expect(api).toContain("tokenUsages: { select: { totalTokens: true, cost: true } }");
  });

  it("wires every admin path into the Vite catch-all server router", () => {
    expect(viteConfig).toContain('pathname.startsWith("/api/admin/")');
    expect(viteConfig).toContain('api/admin/[...route].js');
  });
});
