import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../../server/index.ts", import.meta.url), "utf8");
const viteAnalyzeSource = viteSource.slice(viteSource.lastIndexOf("// /api/analyze"));

describe("analysis runtime routing", () => {
  it("forwards Vite requests and their authorization headers to the Vercel handler", () => {
    expect(viteAnalyzeSource).toContain('path.join(PROJECT_ROOT, "api", "analyze.js")');
    expect(viteAnalyzeSource).toContain("headers: req.headers");
    expect(viteAnalyzeSource).toContain("body,");
    expect(viteAnalyzeSource).not.toContain("body: body ? JSON.parse(body) : undefined");
    expect(viteAnalyzeSource).toContain('req.method !== "POST" && req.method !== "OPTIONS"');
    expect(viteAnalyzeSource).not.toContain('import("./server/api/analyze")');
  });

  it("delegates the Express route to the Vercel handler", () => {
    expect(serverSource).toContain("default: analyzeHandler");
    expect(serverSource).toContain("await analyzeHandler(req, res)");
    expect(serverSource).toContain('app.options("/api/analyze", handleAnalyze)');
    expect(serverSource).not.toContain("analyzeCoverLetter");
  });
});
