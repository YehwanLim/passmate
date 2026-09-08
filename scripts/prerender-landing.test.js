import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LANDING_CANVAS_CLASS,
  LANDING_CANVAS_STYLE,
  ROOT_PLACEHOLDER,
  injectPrerenderedRoot,
  markLandingCanvas,
} from "./prerender-landing.mjs";

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

describe("markLandingCanvas", () => {
  it("adds the landing canvas class and an inline background to the html tag", () => {
    // body 는 라이트 테마라 iOS 오버스크롤·미도색 타일이 흰색으로 비친다. 프리렌더 HTML 에는
    // Home.tsx 가 마운트 후 붙이는 클래스를 미리 넣어 첫 진입부터 검게 보이게 한다.
    // 인라인 style 은 렌더 차단 CSS 가 오기 전(느린 망 2~3초)의 빈 화면까지 검게 만든다.
    const result = markLandingCanvas('<!doctype html>\n<html lang="ko">\n<head></head><body></body></html>');
    expect(result).toContain(
      `<html lang="ko" class="${LANDING_CANVAS_CLASS}" style="${LANDING_CANVAS_STYLE}">`
    );
    expect(LANDING_CANVAS_STYLE).toContain("#050505");
  });

  it("throws when there is no single html tag or it already carries a class or style", () => {
    expect(() => markLandingCanvas("<body></body>")).toThrow(/<html>/);
    expect(() => markLandingCanvas('<html class="x"><body></body></html>')).toThrow(/class or style/);
    expect(() => markLandingCanvas('<html style="x"><body></body></html>')).toThrow(/class or style/);
  });

  it("uses the same class name as index.css and Home.tsx", () => {
    const css = readFileSync(path.join(ROOT_DIR, "client/src/index.css"), "utf8");
    const home = readFileSync(path.join(ROOT_DIR, "client/src/pages/Home.tsx"), "utf8");
    expect(css).toContain(`html.${LANDING_CANVAS_CLASS}`);
    expect(home).toContain(`classList.add("${LANDING_CANVAS_CLASS}")`);
    expect(home).toContain(`classList.remove("${LANDING_CANVAS_CLASS}")`);
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
