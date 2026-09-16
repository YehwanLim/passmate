/**
 * 빌드 시점 프리렌더 — `pnpm build` 의 한 단계.
 *
 * 1. `vite build` 가 만든 dist/public/index.html(빈 SPA 껍데기)을 app.html 로 복사한다.
 *    vercel.json 의 catch-all 리라이트가 클라이언트 전용 라우트를 app.html 로 보낸다.
 * 2. `vite build --ssr` 가 만든 dist/ssr/entry-server.js 로 lib/seo.ts 의 PRERENDER_ROUTES 를 하나씩 렌더해
 *    셸의 <div id="root"></div> 에 주입하고 라우트별 검색 메타(SEO_ROUTES)를 <head> 에 굽는다.
 *    `/` 는 index.html 로 덮어써 Vercel 파일시스템 우선 규칙으로 받고, 나머지는 `<name>.html` 로 두어
 *    vercel.json 이 해당 경로(필요하면 쿼리 조건 포함)를 그 파일로 리라이트한다. 404.html 은 Vercel 이 미매칭 요청에 준다.
 *
 * 설계: docs/superpowers/specs/2026-09-08-랜딩-프리렌더-design.md, docs/superpowers/specs/2026-09-14-seo-design.md
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

/** <html> 에 class·style 을 미리 박는다. 페이지마다 첫 화면 배경색이 달라 값을 받는다. */
export function markDocumentCanvas(html, { className = null, style }) {
  const matches = html.match(/<html\b[^>]*>/g) ?? [];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one <html> tag (found ${matches.length})`);
  }
  const [tag] = matches;
  if (/\b(class|style)=/.test(tag)) {
    throw new Error(`<html> already has a class or style attribute: ${tag}`);
  }
  const classAttr = className ? ` class="${className}"` : "";
  return html.replace(tag, tag.replace(/>$/, `${classAttr} style="${style}">`));
}

export function markLandingCanvas(html) {
  return markDocumentCanvas(html, { className: LANDING_CANVAS_CLASS, style: LANDING_CANVAS_STYLE });
}

// main.tsx 는 이 속성이 현재 주소의 라우트 키(lib/seo.ts routeKey)와 같을 때만 hydrateRoot 를 쓴다.
export const PRERENDERED_ATTR = "data-prerendered";

export function injectPrerenderedRoot(shellHtml, renderedMarkup, routeKey = null) {
  const occurrences = shellHtml.split(ROOT_PLACEHOLDER).length - 1;
  if (occurrences !== 1) {
    throw new Error(
      `index.html must contain the empty root placeholder ${ROOT_PLACEHOLDER} exactly once (found ${occurrences})`
    );
  }
  const marker = routeKey ? ` ${PRERENDERED_ATTR}="${escapeAttribute(routeKey)}"` : "";
  return shellHtml.replace(ROOT_PLACEHOLDER, `<div id="root"${marker}>${renderedMarkup}</div>`);
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

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(pattern) ?? [];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${label} (found ${matches.length})`);
  }
  return html.replace(matches[0], replacement);
}

function metaPattern(attr, key) {
  // client/index.html 은 prettier 가 긴 <meta> 를 여러 줄로 나누므로 공백·줄바꿈을 허용한다.
  return new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`, "g");
}

/**
 * 셸(client/index.html)의 랜딩 기본 메타를 라우트별 값(client/src/lib/seo.ts 의 RouteMeta)으로 바꾸고
 * canonical·robots 를 </head> 앞에 단다. 프리렌더한 페이지에만 적용한다. app.html 은 이 변환 전에 복사되므로
 * 다른 경로는 자기 주소를 유지한다(사이트 전체에 canonical 을 걸면 다른 공개 페이지까지 `/` 로 합쳐진다).
 */
export function applyHeadMeta(html, meta) {
  if (/<link\b[^>]*rel="canonical"/.test(html)) {
    throw new Error("html already has a canonical link");
  }
  if (/<meta\b[^>]*name="robots"/.test(html)) {
    throw new Error("html already has a robots meta");
  }
  const title = escapeAttribute(meta.title);
  const description = escapeAttribute(meta.description);
  let result = replaceOnce(html, /<title>[^<]*<\/title>/g, `<title>${title}</title>`, "<title>");
  const replacements = [
    ["name", "description", description],
    ["property", "og:title", title],
    ["property", "og:description", description],
    ["name", "twitter:title", title],
    ["name", "twitter:description", description],
    ["property", "og:type", meta.ogType ?? "website"],
  ];
  if (meta.canonical) replacements.push(["property", "og:url", escapeAttribute(meta.canonical)]);
  for (const [attr, key, content] of replacements) {
    result = replaceOnce(
      result,
      metaPattern(attr, key),
      `<meta ${attr}="${key}" content="${content}" />`,
      `<meta ${attr}="${key}">`
    );
  }
  const extra = [];
  if (meta.canonical) extra.push(`<link rel="canonical" href="${escapeAttribute(meta.canonical)}" />`);
  if (meta.robots) extra.push(`<meta name="robots" content="${escapeAttribute(meta.robots)}" />`);
  // schema.org 데이터 블록. 실행되지 않으므로 CSP script-src 대상이 아니다. `<` 는 </script> 로 블록이 끊기지 않게 이스케이프.
  for (const block of meta.jsonLd ?? []) {
    extra.push(`<script type="application/ld+json">${JSON.stringify(block).replace(/</g, "\\u003c")}</script>`);
  }
  return replaceOnce(result, /<\/head>/g, `${extra.join("")}</head>`, "</head>");
}

function escapeXml(value) {
  return escapeAttribute(value);
}

/** 색인 대상 페이지(robots 없음 + canonical 있음)만 sitemap 에 올린다. lastmod 는 메타의 updated. */
export function sitemapEntries(pages) {
  return pages
    .filter(({ meta }) => !meta.robots && meta.canonical)
    .map(({ meta }) => ({ loc: meta.canonical, lastmod: meta.updated ?? null }));
}

export function buildSitemap(entries) {
  const urls = entries.map(({ loc, lastmod }) => {
    const lines = [`    <loc>${escapeXml(loc)}</loc>`];
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    return `  <url>\n${lines.join("\n")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export const RSS_FILE = "rss.xml";

/** 가이드 글 RSS 2.0. 네이버 서치어드바이저는 sitemap 과 RSS 를 모두 받는다. 글이 없어도 유효한 빈 채널이어야 한다. */
export function buildRss(items, { origin = "https://pre-view.me" } = {}) {
  const channelItems = items.map(item =>
    [
      "    <item>",
      `      <title>${escapeXml(item.title)}</title>`,
      `      <link>${escapeXml(item.url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(item.url)}</guid>`,
      `      <description>${escapeXml(item.description)}</description>`,
      `      <pubDate>${new Date(`${item.date}T00:00:00+09:00`).toUTCString()}</pubDate>`,
      "    </item>",
    ].join("\n")
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>Pre:View 취업 가이드</title>",
    `    <link>${origin}/guide</link>`,
    "    <description>채용 담당자가 진짜 보는 것. 첫인상·문항별·수정 순서·면접 후기로 정리한 Pre:View 취업 가이드.</description>",
    "    <language>ko</language>",
    ...channelItems,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

// 공개 예시 리포트(ReportResult 의 ?sample=1). vercel.json 이 `/report-new` + `sample=1` 쿼리를 이 파일로 보낸다.
export const SAMPLE_REPORT_FILE = "sample-report.html";
export const SAMPLE_REPORT_ROUTE_KEY = "/report-new?sample=1";
// 리포트 페이지 <main> 배경. 랜딩 클래스는 붙이지 않는다(landing-canvas 는 랜딩 전용 규칙을 켠다).
export const SAMPLE_REPORT_CANVAS_STYLE = "background-color:#09090B";

// 프리렌더 경로(lib/seo.ts PRERENDER_ROUTES)별 첫 화면 배경. 목록에 없는 페이지(404, 라이트 테마)는 그대로 둔다.
export const CANVAS_BY_ROUTE = {
  "/": { className: LANDING_CANVAS_CLASS, style: LANDING_CANVAS_STYLE },
  [SAMPLE_REPORT_ROUTE_KEY]: { style: SAMPLE_REPORT_CANVAS_STYLE },
  "/company-report?sample=1": { style: SAMPLE_REPORT_CANVAS_STYLE },
  "/terms": { style: LANDING_CANVAS_STYLE },
  "/privacy": { style: LANDING_CANVAS_STYLE },
  "/entitlements": { style: "background-color:#0A0A0A" },
};

function assertMarkup(name, markup) {
  if (!markup || markup.length < 1000) {
    throw new Error(`prerendered ${name} markup is suspiciously short (${markup?.length ?? 0} chars)`);
  }
}

/** 렌더한 마크업을 셸에 넣고 배경·critical CSS·head 메타·지연 부트까지 입힌 완성 HTML. */
export async function buildPage(shellHtml, { markup, meta, routeKey, canvas, publicDir }) {
  let html = injectPrerenderedRoot(shellHtml, markup, routeKey);
  if (canvas) html = markDocumentCanvas(html, canvas);
  html = await inlineCriticalCss(html, publicDir);
  return deferEntryScript(applyHeadMeta(html, meta));
}

async function main() {
  const rootDir = path.resolve(import.meta.dirname, "..");
  const publicDir = path.join(rootDir, "dist", "public");
  const indexPath = path.join(publicDir, "index.html");
  const shellPath = path.join(publicDir, "app.html");
  const ssrEntry = path.join(rootDir, "dist", "ssr", "entry-server.js");

  const shellHtml = readFileSync(indexPath, "utf8");
  copyFileSync(indexPath, shellPath);
  console.log(`[prerender] shell → ${path.relative(rootDir, shellPath)}`);

  if (!existsSync(path.join(publicDir, BOOT_SCRIPT))) {
    throw new Error(`${BOOT_SCRIPT} is missing from ${publicDir} (client/public/landing-boot.js)`);
  }

  const { renderRoute, getPrerenderPages, getGuideFeedItems } = await import(pathToFileURL(ssrEntry).href);
  const pages = getPrerenderPages();
  for (const { route, meta } of pages) {
    const markup = await renderRoute(route.path, route.search);
    assertMarkup(route.key, markup);
    const html = await buildPage(shellHtml, {
      markup,
      meta,
      routeKey: route.key,
      canvas: CANVAS_BY_ROUTE[route.key] ?? null,
      publicDir,
    });
    const outPath = path.join(publicDir, route.file);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    const inlineCss = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    console.log(
      `[prerender] ${route.key} → ${path.relative(rootDir, outPath)} (${Math.round(markup.length / 1024)}KB markup, ${Math.round(inlineCss.length / 1024)}KB critical CSS inlined)`
    );
  }

  // sitemap·RSS 는 프리렌더 목록에서 생성한다. client/public 의 정적 사본이 있어도 여기서 덮어쓴다.
  const entries = sitemapEntries(pages);
  writeFileSync(path.join(publicDir, "sitemap.xml"), buildSitemap(entries));
  const feedItems = getGuideFeedItems();
  writeFileSync(path.join(publicDir, RSS_FILE), buildRss(feedItems));
  console.log(`[prerender] sitemap.xml (${entries.length} urls), ${RSS_FILE} (${feedItems.length} guides)`);
}

const isDirectRun =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch(error => {
    console.error("[prerender] failed:", error);
    process.exit(1);
  });
}
