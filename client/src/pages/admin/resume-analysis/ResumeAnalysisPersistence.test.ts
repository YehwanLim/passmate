import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const hook = readFileSync(new URL("../../../hooks/admin/useAnalysesData.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../../../../../api/admin/resume-analysis.js", import.meta.url), "utf8");
const viteConfig = readFileSync(new URL("../../../../../vite.config.ts", import.meta.url), "utf8");

describe("admin resume analysis persistence", () => {
  it("loads admin rows from the server API that reads persisted analyses", () => {
    expect(hook).toContain("/api/admin/resume-analysis?");
    expect(hook).toContain("window.fetch(`/api/admin/resume-analysis?");
    expect(hook).not.toContain("const fetch = async");
    expect(hook).toContain('content-type") ?? ""');
    expect(hook).toContain("JSON 대신 HTML");
    expect(hook).not.toContain('.from("analyses")');
    expect(api).toContain("prisma.analysis.findMany");
    expect(api).toContain("user: { select: { email: true, name: true } }");
    expect(api).toContain("project: { select: { title: true, company: true, jobKeyword: true } }");
    expect(api).toContain("tokenUsages: { select: { totalTokens: true, cost: true } }");
  });

  it("wires the admin resume API into the local Vite dev server", () => {
    expect(viteConfig).toContain('/api/admin/resume-analysis');
    expect(viteConfig).toContain('api", "admin", "resume-analysis.js"');
  });
});
