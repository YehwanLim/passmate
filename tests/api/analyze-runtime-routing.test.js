import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../../server/index.ts", import.meta.url), "utf8");

describe("analysis runtime routing", () => {
  it("forwards Vite requests and their authorization headers to the Vercel handler", () => {
    expect(viteSource).toContain('path.join(PROJECT_ROOT, "api", "analyze.js")');
    expect(viteSource).toContain("headers: req.headers");
    expect(viteSource).toContain('req.method !== "POST" && req.method !== "OPTIONS"');
    expect(viteSource).not.toContain('import("./server/api/analyze")');
  });

  it("delegates the Express route to the Vercel handler", () => {
    expect(serverSource).toContain("default: analyzeHandler");
    expect(serverSource).toContain("return analyzeHandler(req, res)");
    expect(serverSource).not.toContain("analyzeCoverLetter");
  });
});
