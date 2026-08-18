import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viteSource = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const serverSource = readFileSync(new URL("../../server/index.ts", import.meta.url), "utf8");
describe("analysis runtime routing", () => {
  it("forwards Vite requests and their authorization headers to the Vercel handler", () => {
    expect(viteSource).toContain('if (pathname === "/api/analyze") return { file: "api/analyze.js", query: {} }');
    expect(viteSource).toContain("headers: req.headers");
    expect(viteSource).toContain("body,");
    expect(viteSource).toContain("pathToFileURL(path.join(PROJECT_ROOT, route.file))");
    expect(viteSource).not.toContain('import("./server/api/analyze")');
  });

  it("delegates the Express route to the Vercel handler", () => {
    expect(serverSource).toContain('import analyzeHandler from "../api/analyze.js"');
    expect(serverSource).toContain('app.all("/api/analyze", (req, res) => analyzeHandler(req, res))');
    expect(serverSource).not.toContain("analyzeCoverLetter");
  });
});
