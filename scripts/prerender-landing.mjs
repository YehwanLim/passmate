/**
 * 랜딩 프리렌더 — `pnpm build` 의 한 단계.
 *
 * 1. `vite build` 가 만든 dist/public/index.html(빈 SPA 껍데기)을 app.html 로 복사한다.
 *    vercel.json 의 catch-all 리라이트가 비-API 경로를 app.html 로 보낸다.
 * 2. `vite build --ssr` 가 만든 dist/ssr/entry-server.js 로 `/` 를 렌더해
 *    index.html 의 <div id="root"></div> 에 주입한다. `/` 는 Vercel 파일시스템 우선 규칙으로 이 파일을 받는다.
 *
 * 설계: docs/superpowers/specs/2026-09-08-랜딩-프리렌더-design.md
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Beasties from "beasties";

export const ROOT_PLACEHOLDER = '<div id="root"></div>';
// Home.tsx 가 마운트 시 <html> 에 붙이는 클래스(index.css `html.landing-canvas`). 프리렌더 HTML 에 미리 넣어
// 하이드레이션 전에도 iOS 오버스크롤·미도색 타일이 흰색이 아니라 검게 보이게 한다.
export const LANDING_CANVAS_CLASS = "landing-canvas";
// 같은 색을 인라인 style 로도 박는다. 렌더 차단 CSS(약 50KB gz)가 JS 와 대역폭을 나눠 쓰느라 느린 망에서
// 2~3초 뒤에 오는데, 그동안 브라우저가 그리는 빈 화면이 흰색이 아니라 랜딩 배경색이게 한다(CSP 는 style 인라인 허용).
export const LANDING_CANVAS_STYLE = "background-color:#050505";

export function markLandingCanvas(html) {
  const matches = html.match(/<html\b[^>]*>/g) ?? [];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one <html> tag (found ${matches.length})`);
  }
  const [tag] = matches;
  if (/\b(class|style)=/.test(tag)) {
    throw new Error(`<html> already has a class or style attribute: ${tag}`);
  }
  return html.replace(
    tag,
    tag.replace(/>$/, ` class="${LANDING_CANVAS_CLASS}" style="${LANDING_CANVAS_STYLE}">`)
  );
}

export function injectPrerenderedRoot(shellHtml, renderedMarkup) {
  const occurrences = shellHtml.split(ROOT_PLACEHOLDER).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `index.html must contain the empty root placeholder ${ROOT_PLACEHOLDER} exactly once (found ${occurrences})`
    );
  }
  return shellHtml.replace(ROOT_PLACEHOLDER, `<div id="root">${renderedMarkup}</div>`);
}

// 전체 CSS(약 50KB gz)는 렌더 차단이라 느린 망에서 첫 픽셀이 2~3초 늦었다. 랜딩 HTML 이 실제로 쓰는 규칙만
// <style> 로 인라인해 HTML 도착 즉시 그려지게 하고, 전체 CSS 는 preload 만 건다. 메뉴·토스트처럼 JS 뒤에
// 생기는 UI 는 전체 CSS 가 필요하므로 main.tsx(applyFullStylesheet)가 하이드레이션 직전에 stylesheet 로 되돌린다.
// CSP 가 인라인 스크립트를 막아 beasties 의 onload/스크립트 기반 전략은 쓸 수 없다.
export const FULL_CSS_ATTR = "data-full-css";
const STYLESHEET_LINK_RE = /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g;

export async function inlineCriticalCss(html, publicDir) {
  const beasties = new Beasties({
    path: publicDir,
    publicPath: "/",
    preload: false, // 링크는 아래서 직접 preload 로 바꾼다
    fonts: false, // @font-face 는 인라인·preload 하지 않는다(한글 서브셋이 19개라 전체 CSS 에 맡긴다)
    reduceInlineStyles: false,
    // Tailwind 4 는 space-y-*/group-hover 를 `:where(...)` 선택자로 내보내는데 beasties 가 이를 매칭하지 못해
    // 목록 간격이 빠진다(계산된 스타일 비교로 발견). 해당 규칙은 사용 여부와 무관하게 포함한다(수백 바이트).
    allowRules: [/\.space-[xy]-/, /:where\(\.group\)/],
    logLevel: "warn",
  });
  const processed = await beasties.process(html);
  const links = processed.match(STYLESHEET_LINK_RE) ?? [];
  if (links.length !== 1) {
    throw new Error(`expected exactly one stylesheet link to defer (found ${links.length})`);
  }
  if (!processed.includes("<style>")) {
    throw new Error("beasties produced no inline <style>");
  }
  return processed.replace(
    STYLESHEET_LINK_RE,
    `<link rel="preload" as="style" crossorigin href="$1" ${FULL_CSS_ATTR}>`
  );
}

// 진입 번들을 <link rel="modulepreload"> + /landing-boot.js 로 바꾼다. LTE 에선 번들이 HTML 과 거의 동시에
// 와서 WebKit 이 첫 페인트 전에 번들을 평가해 폰에서 흰 화면이 수 초 이어졌다(client/public/landing-boot.js 참고).
export const BOOT_SCRIPT = "/landing-boot.js";
const ENTRY_SCRIPT_RE = /<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"><\/script>/g;

export function deferEntryScript(html) {
  const matches = html.match(ENTRY_SCRIPT_RE) ?? [];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one module entry script to defer (found ${matches.length})`);
  }
  return html.replace(
    ENTRY_SCRIPT_RE,
    `<link rel="modulepreload" crossorigin href="$1" data-entry><script defer src="${BOOT_SCRIPT}"></script>`
  );
}

async function main() {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const publicDir = path.join(rootDir, "dist", "public");
  const indexPath = path.join(publicDir, "index.html");
  const shellPath = path.join(publicDir, "app.html");
  const ssrEntry = path.join(rootDir, "dist", "ssr", "entry-server.js");

  const shellHtml = readFileSync(indexPath, "utf8");
  copyFileSync(indexPath, shellPath);

  const { render } = await import(pathToFileURL(ssrEntry).href);
  const markup = render("/");
  if (!markup || markup.length < 1000) {
    throw new Error(`prerendered landing markup is suspiciously short (${markup?.length ?? 0} chars)`);
  }

  if (!existsSync(path.join(publicDir, BOOT_SCRIPT))) {
    throw new Error(`${BOOT_SCRIPT} is missing from ${publicDir} (client/public/landing-boot.js)`);
  }
  const landingHtml = deferEntryScript(
    await inlineCriticalCss(markLandingCanvas(injectPrerenderedRoot(shellHtml, markup)), publicDir)
  );
  writeFileSync(indexPath, landingHtml);
  const inlineCss = landingHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  console.log(
    `[prerender] landing → ${path.relative(rootDir, indexPath)} (${Math.round(markup.length / 1024)}KB markup, ${Math.round(inlineCss.length / 1024)}KB critical CSS inlined), shell → ${path.relative(rootDir, shellPath)}`
  );
}

const isDirectRun =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch(error => {
    console.error("[prerender] failed:", error);
    process.exit(1);
  });
}
