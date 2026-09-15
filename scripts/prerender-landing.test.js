import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NOINDEX, PRERENDER_ROUTES, SEO_ROUTES } from "../client/src/lib/seo";
import {
  applyHeadMeta,
  BOOT_SCRIPT,
  buildRss,
  buildSitemap,
  CANVAS_BY_ROUTE,
  sitemapEntries,
  PRERENDERED_ATTR,
  deferEntryScript,
  FULL_CSS_ATTR,
  inlineCriticalCss,
  LANDING_CANVAS_CLASS,
  LANDING_CANVAS_STYLE,
  ROOT_PLACEHOLDER,
  injectPrerenderedRoot,
  markDocumentCanvas,
  markLandingCanvas,
  SAMPLE_REPORT_CANVAS_STYLE,
  SAMPLE_REPORT_FILE,
  SAMPLE_REPORT_ROUTE_KEY,
} from "./prerender-landing.mjs";

const ROOT_DIR = path.resolve(import.meta.dirname, "..");
const SAMPLE_REPORT_META = SEO_ROUTES[SAMPLE_REPORT_ROUTE_KEY];

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

  it("marks the root with the route key so main.tsx hydrates only the matching address", () => {
    const result = injectPrerenderedRoot('<div id="root"></div>', "<p>x</p>", "/report-new?sample=1");
    expect(result).toBe(`<div id="root" ${PRERENDERED_ATTR}="/report-new?sample=1"><p>x</p></div>`);
    const main = readFileSync(path.join(ROOT_DIR, "client/src/main.tsx"), "utf8");
    expect(PRERENDERED_ATTR).toBe("data-prerendered");
    expect(main).toContain("rootElement.dataset.prerendered === routeKey(window.location.pathname, window.location.search)");
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

  it("paints the sample report canvas without the landing class", () => {
    // landing-canvas 는 랜딩 전용 규칙을 켠다. 리포트 페이지는 자기 배경색만 미리 박는다.
    const result = markDocumentCanvas('<html lang="ko"><head></head><body></body></html>', {
      style: SAMPLE_REPORT_CANVAS_STYLE,
    });
    expect(result).toContain(`<html lang="ko" style="${SAMPLE_REPORT_CANVAS_STYLE}">`);
    expect(result).not.toContain("class=");
    expect(SAMPLE_REPORT_CANVAS_STYLE).toContain("#09090B");
  });

  it("uses the same class name as styles/landing.css and Home.tsx", () => {
    const css = readFileSync(path.join(ROOT_DIR, "client/src/styles/landing.css"), "utf8");
    const home = readFileSync(path.join(ROOT_DIR, "client/src/pages/Home.tsx"), "utf8");
    expect(css).toContain(`html.${LANDING_CANVAS_CLASS}`);
    expect(home).toContain(`classList.add("${LANDING_CANVAS_CLASS}")`);
    expect(home).toContain(`classList.remove("${LANDING_CANVAS_CLASS}")`);
  });
});

describe("inlineCriticalCss", () => {
  function buildFixture() {
    const dir = mkdtempSync(path.join(tmpdir(), "prerender-css-"));
    mkdirSync(path.join(dir, "assets"));
    writeFileSync(
      path.join(dir, "assets", "index-abc.css"),
      [
        "@layer base{h1{margin:0}}",
        ".used{color:red}",
        ".used:hover{color:pink}",
        "@media (min-width:768px){.used{color:green}}",
        ".unused{color:blue}",
        "@keyframes rise{from{transform:translateY(24px)}to{transform:none}}",
        "@keyframes unused-kf{from{opacity:0}}",
        ".rise{animation:rise 1s}",
        '@font-face{font-family:"Pretendard";src:url(/x.woff2)}',
        "@property --tw-x{syntax:'*';inherits:false;initial-value:0}",
        ":where(.space-y-2>:not(:last-child)){margin-block-end:8px}",
        ".group-hover\\:opacity-100:is(:where(.group):hover *){opacity:1}",
      ].join("\n")
    );
    const html =
      '<!doctype html><html lang="ko"><head><link rel="stylesheet" crossorigin href="/assets/index-abc.css"></head>' +
      '<body><div id="root"><h1 class="used rise">hi</h1></div></body></html>';
    return { dir, html };
  }

  it("inlines only the rules the landing uses and turns the stylesheet into a preload", async () => {
    // 렌더 차단 CSS 를 기다리는 동안 첫 화면이 비어 있었다. 쓰는 규칙만 인라인하고 전체 CSS 는
    // preload 로 두면 HTML 도착 즉시 그려진다. 전체 CSS 는 main.tsx 가 하이드레이션 직전에 적용한다.
    const { dir, html } = buildFixture();
    const result = await inlineCriticalCss(html, dir);
    const style = result.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    expect(style).toContain(".used{color:red}");
    expect(style).toContain(".used:hover");
    expect(style).toContain("@media (min-width:768px)");
    expect(style).toContain("@keyframes rise");
    expect(style).toContain("@layer base");
    expect(style).toContain("@property --tw-x");
    // Tailwind 4 의 :where(...) 선택자는 beasties 가 못 맞추므로 allowRules 로 강제 포함한다
    expect(style).toContain(":where(.space-y-2>:not(:last-child))");
    expect(style).toContain(":where(.group):hover");
    expect(style).not.toContain(".unused");
    expect(style).not.toContain("unused-kf");
    // 폰트 선언은 인라인하지 않는다(한글 서브셋 19개, 첫 화면 뒤에 받는다)
    expect(style).not.toContain("@font-face");
    expect(result).toContain(
      `<link rel="preload" as="style" crossorigin href="/assets/index-abc.css" ${FULL_CSS_ATTR}>`
    );
    expect(result).not.toContain('rel="stylesheet"');
  });

  it("uses the attribute name main.tsx's applyFullStylesheet looks for", () => {
    const client = readFileSync(path.join(ROOT_DIR, "client/src/applyFullStylesheet.ts"), "utf8");
    expect(client).toContain(`FULL_CSS_ATTR = "${FULL_CSS_ATTR}"`);
    const main = readFileSync(path.join(ROOT_DIR, "client/src/main.tsx"), "utf8");
    expect(main).toContain("applyFullStylesheet();");
  });

  it("throws when the shell has no single stylesheet link to defer", async () => {
    const { dir } = buildFixture();
    await expect(inlineCriticalCss("<html><head></head><body></body></html>", dir)).rejects.toThrow(
      /stylesheet link/
    );
  });
});

describe("deferEntryScript", () => {
  it("swaps the module entry for a modulepreload plus the boot script", () => {
    // LTE 에선 번들이 HTML 과 거의 동시에 와서 WebKit 이 첫 페인트 전에 번들을 평가한다(폰 흰 화면 수 초).
    // 다운로드는 미리(modulepreload), 평가는 landing-boot.js 가 첫 프레임 뒤로 미룬다.
    const html =
      '<head><script type="module" crossorigin src="/assets/index-abc.js"></script><style></style></head>';
    const result = deferEntryScript(html);
    expect(result).toContain('<link rel="modulepreload" crossorigin href="/assets/index-abc.js" data-entry>');
    expect(result).toContain(`<script defer src="${BOOT_SCRIPT}"></script>`);
    expect(result).not.toContain('type="module"');
  });

  it("throws unless exactly one module entry script is present", () => {
    expect(() => deferEntryScript("<head></head>")).toThrow(/entry script/);
  });

  it("ships the boot script from client/public so vite copies it into the build", () => {
    const boot = readFileSync(path.join(ROOT_DIR, "client/public", BOOT_SCRIPT), "utf8");
    expect(boot).toContain('link[rel="modulepreload"][data-entry]');
  });

  it("hydrates inside startTransition so WebKit can paint tiles while hydration yields", () => {
    const main = readFileSync(path.join(ROOT_DIR, "client/src/main.tsx"), "utf8");
    expect(main).toMatch(/startTransition\(\(\) => \{?\s*hydrateRoot\(/);
  });
});

describe("applyHeadMeta", () => {
  // 실제 셸과 같은 모양: prettier 가 긴 <meta> 를 여러 줄로 나눈다.
  const shell = [
    "<html><head>",
    "<title>랜딩</title>",
    '<meta\n  name="description"\n  content="랜딩 설명" />',
    '<meta property="og:type" content="website" />',
    '<meta property="og:url" content="https://pre-view.me/" />',
    '<meta property="og:title" content="랜딩" />',
    '<meta\n  property="og:description"\n  content="랜딩 설명" />',
    '<meta name="twitter:title" content="랜딩" />',
    '<meta name="twitter:description" content="랜딩 설명" />',
    "</head><body></body></html>",
  ].join("\n");

  it("rewrites title, description, open graph and twitter tags and adds the canonical", () => {
    const result = applyHeadMeta(shell, SAMPLE_REPORT_META);
    expect(result).toContain(`<title>${SAMPLE_REPORT_META.title}</title>`);
    expect(result).toContain(`<meta name="description" content="${SAMPLE_REPORT_META.description}" />`);
    expect(result).toContain(`<meta property="og:title" content="${SAMPLE_REPORT_META.title}" />`);
    expect(result).toContain(`<meta property="og:description" content="${SAMPLE_REPORT_META.description}" />`);
    expect(result).toContain(`<meta property="og:url" content="${SAMPLE_REPORT_META.canonical}" />`);
    expect(result).toContain(`<meta name="twitter:title" content="${SAMPLE_REPORT_META.title}" />`);
    expect(result).toContain(`<link rel="canonical" href="${SAMPLE_REPORT_META.canonical}" /></head>`);
    expect(result).not.toContain("랜딩");
    expect(result).not.toContain('name="robots"');
  });

  it("adds robots noindex and no canonical for a private page", () => {
    const result = applyHeadMeta(shell, { title: "로그인 | Pre:View", description: "설명 텍스트 열 글자 이상", robots: NOINDEX });
    expect(result).toContain(`<meta name="robots" content="${NOINDEX}" /></head>`);
    expect(result).not.toContain('rel="canonical"');
    // canonical 이 없는 페이지는 색인 대상이 아니므로 셸의 og:url 은 건드리지 않는다.
    expect(result).toContain('<meta property="og:url" content="https://pre-view.me/" />');
  });

  it("escapes attribute characters", () => {
    const result = applyHeadMeta(shell, {
      title: 'A & B "quoted" <tag>',
      description: "설명",
      canonical: "https://pre-view.me/report-new?sample=1&x=1",
    });
    expect(result).toContain("<title>A &amp; B &quot;quoted&quot; &lt;tag&gt;</title>");
    expect(result).toContain('href="https://pre-view.me/report-new?sample=1&amp;x=1"');
  });

  it("throws when a canonical or robots meta already exists, or a tag is missing", () => {
    expect(() =>
      applyHeadMeta(shell.replace("</head>", '<link rel="canonical" href="/" /></head>'), SAMPLE_REPORT_META)
    ).toThrow(/already/);
    expect(() =>
      applyHeadMeta(shell.replace("</head>", '<meta name="robots" content="noindex" /></head>'), SAMPLE_REPORT_META)
    ).toThrow(/already/);
    expect(() => applyHeadMeta(shell.replace("<title>랜딩</title>", ""), SAMPLE_REPORT_META)).toThrow(/<title>/);
    expect(() => applyHeadMeta("<html><body></body></html>", SAMPLE_REPORT_META)).toThrow(/<title>/);
  });

  it("works on the real shell and keeps the shell itself free of a canonical", () => {
    // app.html 은 client/index.html 에서 나온다. 여기에 canonical 을 걸면 샘플 리포트도 `/` 로 합쳐진다.
    const realShell = readFileSync(path.join(ROOT_DIR, "client/index.html"), "utf8");
    expect(realShell).not.toContain('rel="canonical"');
    const result = applyHeadMeta(realShell, SEO_ROUTES["/"]);
    expect(result).toContain(`<link rel="canonical" href="${SEO_ROUTES["/"].canonical}" />`);
    expect(result).toContain('<script type="application/ld+json">');
    expect(result.match(/<title>/g)).toHaveLength(1);
    expect(result.match(/name="description"/g)).toHaveLength(1);
  });

  it("embeds the route's schema.org blocks as ld+json data scripts", () => {
    const result = applyHeadMeta(shell, SEO_ROUTES["/"]);
    const scripts = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) ?? [];
    expect(scripts).toHaveLength(3);
    const types = scripts.map(script => JSON.parse(script.replace(/<\/?script[^>]*>/g, ""))["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
  });

  it("escapes < inside the ld+json so a value cannot close the script block", () => {
    const result = applyHeadMeta(shell, {
      title: "t",
      description: "설명",
      jsonLd: [{ "@context": "https://schema.org", "@type": "Thing", name: "</script><b>" }],
    });
    expect(result.match(/<\/script>/g)).toHaveLength(1);
    expect(result).toContain("\\u003c/script>");
  });
});

describe("sitemap and rss generation", () => {
  const pages = [
    { route: { key: "/" }, meta: SEO_ROUTES["/"] },
    { route: { key: SAMPLE_REPORT_ROUTE_KEY }, meta: SAMPLE_REPORT_META },
    { route: { key: "/login" }, meta: SEO_ROUTES["/login"] },
    { route: { key: "/404" }, meta: SEO_ROUTES["/404"] },
  ];

  it("lists only indexable pages with their lastmod", () => {
    const entries = sitemapEntries(pages);
    expect(entries.map(entry => entry.loc)).toEqual([SEO_ROUTES["/"].canonical, SAMPLE_REPORT_META.canonical]);
    expect(entries[0].lastmod).toBe(SEO_ROUTES["/"].updated);
    const xml = buildSitemap(entries);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain(`<loc>${SAMPLE_REPORT_META.canonical}</loc>`);
    expect(xml).toContain(`<lastmod>${SEO_ROUTES["/"].updated}</lastmod>`);
    expect(xml).not.toContain("/login");
    expect(xml).not.toContain("changefreq");
  });

  it("escapes ampersands in query urls", () => {
    const xml = buildSitemap([{ loc: "https://pre-view.me/x?a=1&b=2", lastmod: null }]);
    expect(xml).toContain("<loc>https://pre-view.me/x?a=1&amp;b=2</loc>");
    expect(xml).not.toContain("<lastmod>");
  });

  it("builds a valid RSS channel even with no guides, and dates items in UTC", () => {
    expect(buildRss([])).toContain("<rss version=\"2.0\">");
    const xml = buildRss([
      { title: "A & B", description: "설명", url: "https://pre-view.me/guide/a", date: "2026-09-15" },
    ]);
    expect(xml).toContain("<title>A &amp; B</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://pre-view.me/guide/a</guid>');
    // KST 자정 = 전날 15:00 UTC
    expect(xml).toContain("<pubDate>Mon, 14 Sep 2026 15:00:00 GMT</pubDate>");
  });
});

describe("prerendered sample report", () => {
  it("rewrites only the sample query of /report-new to the prerendered file, before the SPA fallback", () => {
    // 실제 리포트(/report-new?analysisId=…)는 app.html 로 가야 하므로 쿼리 조건이 있어야 한다.
    const vercel = JSON.parse(readFileSync(path.join(ROOT_DIR, "vercel.json"), "utf8"));
    const sampleIndex = vercel.rewrites.findIndex(rule => rule.destination === `/${SAMPLE_REPORT_FILE}`);
    const fallbackIndex = vercel.rewrites.findIndex(rule => rule.destination === "/app.html");
    expect(sampleIndex).toBeGreaterThan(-1);
    expect(sampleIndex).toBeLessThan(fallbackIndex);
    expect(vercel.rewrites[sampleIndex]).toEqual({
      source: "/report-new",
      has: [{ type: "query", key: "sample", value: "1" }],
      destination: `/${SAMPLE_REPORT_FILE}`,
    });
  });

  it("hydrates the sample report with the real search string", () => {
    // wouter 의 useSearch 는 하이드레이션 첫 패스에 ssrSearch(기본 "")를 돌려준다. 실제 검색어를 넘기지 않으면
    // ?sample=1 이 빈 검색어로 그려져 로그인 게이트가 나오고 서버 HTML 과 어긋난다(React 418).
    const main = readFileSync(path.join(ROOT_DIR, "client/src/main.tsx"), "utf8");
    expect(main).toMatch(/<Router ssrPath=\{window\.location\.pathname\} ssrSearch=\{window\.location\.search\}>/);
    // 기업 예시 리포트도 같은 이유로 window.location 대신 useSearch 를 읽어야 빌드 때 그려진다.
    const companyReport = readFileSync(path.join(ROOT_DIR, "client/src/pages/CompanyReport.tsx"), "utf8");
    expect(companyReport).toContain('new URLSearchParams(useSearch()).get("sample") === "1"');
  });

  it("links the landing to the same sample path the rewrite serves", () => {
    const meta = readFileSync(path.join(ROOT_DIR, "client/src/constants/resumeReportSampleMeta.ts"), "utf8");
    expect(meta).toContain('RESUME_REPORT_SAMPLE_PATH = "/report-new?sample=1"');
  });
});

describe("vercel routing for the prerendered pages", () => {
  const vercel = JSON.parse(readFileSync(path.join(ROOT_DIR, "vercel.json"), "utf8"));
  const fallbackIndex = vercel.rewrites.findIndex(rule => rule.destination === "/app.html");
  const fallback = vercel.rewrites[fallbackIndex];
  // path-to-regexp 의 `/(regex)` 소스를 JS 정규식으로 바꿔 어떤 경로가 SPA 셸을 받는지 흉내낸다.
  const fallbackPattern = new RegExp(`^${fallback.source.slice(1)}$`);
  const matchesFallback = pathname => fallbackPattern.test(pathname.slice(1));

  it("sends only client-rendered routes to the SPA shell so unknown paths get a real 404", () => {
    // 예전 catch-all(`/((?!api/).*)`)은 없는 주소에도 app.html 을 200 으로 줬다(soft 404).
    expect(fallbackIndex).toBe(vercel.rewrites.length - 1);
    for (const pathname of ["/login", "/analyze", "/report-new", "/company-report", "/my", "/my/p1", "/admin", "/admin/users", "/checkout", "/account/deletion", "/feedback", "/analysis-pending", "/company-analysis"]) {
      expect(matchesFallback(pathname), pathname).toBe(true);
    }
    for (const pathname of ["/no-such-page", "/terms", "/privacy", "/entitlements", "/404", "/api/analyze", "/myth", "/loginx"]) {
      expect(matchesFallback(pathname), pathname).toBe(false);
    }
  });

  it("covers every top-level client route declared in App.tsx", () => {
    // 최상위 라우트를 추가하면 여기 허용목록도 같이 고쳐야 한다(CLAUDE.md 함정 1과 같은 수동 매핑).
    const app = readFileSync(path.join(ROOT_DIR, "client/src/App.tsx"), "utf8");
    const paths = [...app.matchAll(/<Route path=\{"([^"]+)"\}/g)].map(([, routePath]) => routePath);
    expect(paths.length).toBeGreaterThan(10);
    for (const routePath of paths) {
      const segment = `/${routePath.split("/")[1]}`;
      if (segment === "/") continue;
      const prerendered = PRERENDER_ROUTES.some(route => route.path === segment && route.search === "");
      expect(prerendered || matchesFallback(segment), routePath).toBe(true);
    }
  });

  it("rewrites each prerendered page to its file before the SPA fallback", () => {
    for (const route of PRERENDER_ROUTES) {
      if (route.file === "index.html") continue; // `/` 는 파일시스템 우선으로 받는다
      const index = vercel.rewrites.findIndex(rule => rule.destination === `/${route.file}`);
      expect(index, route.key).toBeGreaterThan(-1);
      expect(index, route.key).toBeLessThan(fallbackIndex);
      const rule = vercel.rewrites[index];
      expect(rule.source, route.key).toBe(route.path);
      if (route.search) {
        const [key, value] = route.search.split("=");
        expect(rule.has, route.key).toEqual([{ type: "query", key, value }]);
      } else {
        expect(rule.has, route.key).toBeUndefined();
      }
    }
  });

  it("drops trailing slashes so each page has one URL", () => {
    expect(vercel.trailingSlash).toBe(false);
  });

  it("rewrites guide articles to their prerendered files by slug", () => {
    // 가이드는 content/guides 에서 나와 목록이 동적이라 파라미터 리라이트 하나로 받는다. 없는 slug 는 파일이 없어 404.
    const index = vercel.rewrites.findIndex(rule => rule.source === "/guide/:slug");
    expect(index).toBeGreaterThan(-1);
    expect(index).toBeLessThan(fallbackIndex);
    expect(vercel.rewrites[index].destination).toBe("/guide/:slug.html");
  });

  it("gives every prerendered route a meta entry and a canvas for the dark pages", () => {
    for (const route of PRERENDER_ROUTES) {
      expect(SEO_ROUTES[route.key], route.key).toBeDefined();
      expect(route.file, route.key).toMatch(/\.html$/);
    }
    expect(CANVAS_BY_ROUTE["/"]).toEqual({ className: LANDING_CANVAS_CLASS, style: LANDING_CANVAS_STYLE });
    for (const key of Object.keys(CANVAS_BY_ROUTE)) {
      expect(PRERENDER_ROUTES.some(route => route.key === key), key).toBe(true);
    }
    expect(CANVAS_BY_ROUTE["/404"]).toBeUndefined(); // NotFound 는 라이트 테마
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
