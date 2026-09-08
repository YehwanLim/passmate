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
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

  writeFileSync(indexPath, markLandingCanvas(injectPrerenderedRoot(shellHtml, markup)));
  console.log(
    `[prerender] landing → ${path.relative(rootDir, indexPath)} (${Math.round(markup.length / 1024)}KB markup), shell → ${path.relative(rootDir, shellPath)}`
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
