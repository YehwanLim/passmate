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

  writeFileSync(indexPath, injectPrerenderedRoot(shellHtml, markup));
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
