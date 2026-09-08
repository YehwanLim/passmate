import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT_PLACEHOLDER, injectPrerenderedRoot } from "./prerender-landing.mjs";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");

describe("injectPrerenderedRoot", () => {
  it("fills the empty root div with the rendered markup exactly once", () => {
    const shell = `<html><body>\n    <div id="root"></div>\n    <script type="module" src="/assets/index.js"></script></body></html>`;
    const result = injectPrerenderedRoot(shell, "<div class=\"landing\">hi</div>");
    expect(result).toContain('<div id="root"><div class="landing">hi</div></div>');
    expect(result).not.toContain(ROOT_PLACEHOLDER);
    expect(result).toContain('<script type="module" src="/assets/index.js">');
  });

  it("throws when the shell has no empty root placeholder", () => {
    expect(() => injectPrerenderedRoot("<div id=\"root\">already</div>", "x")).toThrow(/placeholder/);
  });
});

describe("vercel routing for the prerendered landing", () => {
  it("rewrites non-API routes to the SPA shell, not the prerendered index", () => {
    // `/`는 파일시스템 우선으로 프리렌더된 index.html을 받고, 나머지 경로는 빈 껍데기(app.html)를 받아야
    // /analyze 같은 화면에 랜딩 본문이 잠깐 비치지 않는다.
    const vercel = JSON.parse(readFileSync(path.join(ROOT_DIR, "vercel.json"), "utf8"));
    const catchAll = vercel.rewrites.find(rule => rule.source === "/((?!api/).*)");
    expect(catchAll).toBeDefined();
    expect(catchAll.destination).toBe("/app.html");
  });

  it("runs the prerender step in the production build", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"));
    expect(pkg.scripts.build).toContain("vite build --ssr src/entry-server.tsx --outDir ../dist/ssr");
    expect(pkg.scripts.build).toContain("node scripts/prerender-landing.mjs");
    // 클라이언트 빌드가 dist/public을 비운 뒤에 프리렌더가 돌아야 한다.
    expect(pkg.scripts.build.indexOf("vite build &&")).toBeLessThan(
      pkg.scripts.build.indexOf("prerender-landing")
    );
  });
});
