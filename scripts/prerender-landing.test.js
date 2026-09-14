import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  addCanonical,
  addLandingCanonical,
  BOOT_SCRIPT,
  deferEntryScript,
  FULL_CSS_ATTR,
  inlineCriticalCss,
  LANDING_CANVAS_CLASS,
  LANDING_CANVAS_STYLE,
  ROOT_PLACEHOLDER,
  injectPrerenderedRoot,
  LANDING_CANONICAL_URL,
  markDocumentCanvas,
  markLandingCanvas,
  SAMPLE_REPORT_CANONICAL_URL,
  SAMPLE_REPORT_CANVAS_STYLE,
  SAMPLE_REPORT_FILE,
  SAMPLE_REPORT_TITLE,
  setDocumentTitle,
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

describe("addLandingCanonical", () => {
  it("adds the canonical link to the landing head only", () => {
    const result = addLandingCanonical("<html><head><title>x</title></head><body></body></html>");
    expect(LANDING_CANONICAL_URL).toBe("https://pre-view.me/");
    expect(result).toContain(`<link rel="canonical" href="${LANDING_CANONICAL_URL}" /></head>`);
  });

  it("throws when a canonical link already exists or the head is ambiguous", () => {
    expect(() =>
      addLandingCanonical('<html><head><link rel="canonical" href="/" /></head></html>')
    ).toThrow(/already/);
    expect(() => addLandingCanonical("<html><body></body></html>")).toThrow(/<\/head>/);
  });

  it("keeps the site-wide shell free of a canonical so other public pages keep their own URL", () => {
    // app.html 은 client/index.html 에서 나온다. 여기에 canonical 을 걸면 샘플 리포트도 `/` 로 합쳐진다.
    const shell = readFileSync(path.join(ROOT_DIR, "client/index.html"), "utf8");
    expect(shell).not.toContain('rel="canonical"');
  });

  it("gives the prerendered sample report its own canonical, matching the sitemap", () => {
    const sitemap = readFileSync(path.join(ROOT_DIR, "client/public/sitemap.xml"), "utf8");
    expect(sitemap).toContain(`<loc>${SAMPLE_REPORT_CANONICAL_URL}</loc>`);
    const result = addCanonical("<html><head></head><body></body></html>", SAMPLE_REPORT_CANONICAL_URL);
    expect(result).toContain(`<link rel="canonical" href="${SAMPLE_REPORT_CANONICAL_URL}" /></head>`);
  });
});

describe("setDocumentTitle", () => {
  it("replaces the single title tag", () => {
    const result = setDocumentTitle("<head><title>랜딩</title></head>", SAMPLE_REPORT_TITLE);
    expect(result).toBe(`<head><title>${SAMPLE_REPORT_TITLE}</title></head>`);
    expect(SAMPLE_REPORT_TITLE).toContain("예시 리포트");
  });

  it("throws unless exactly one title is present", () => {
    expect(() => setDocumentTitle("<head></head>", "x")).toThrow(/<title>/);
    expect(() => setDocumentTitle("<title>a</title><title>b</title>", "x")).toThrow(/<title>/);
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

  it("hydrates the sample report instead of re-rendering it from scratch", () => {
    // main.tsx 가 프리렌더 경로로 알아야 hydrateRoot 를 쓴다. 아니면 서버 HTML 을 비우고 새로 그려 첫 화면이 깜빡인다.
    const main = readFileSync(path.join(ROOT_DIR, "client/src/main.tsx"), "utf8");
    expect(main).toContain('pathname === "/report-new"');
    expect(main).toContain('get("sample") === "1"');
    // wouter 의 useSearch 는 하이드레이션 첫 패스에 ssrSearch(기본 "")를 돌려준다. 실제 검색어를 넘기지 않으면
    // ?sample=1 이 빈 검색어로 그려져 로그인 게이트가 나오고 서버 HTML 과 어긋난다(React 418).
    expect(main).toMatch(/<Router ssrPath=\{window\.location\.pathname\} ssrSearch=\{window\.location\.search\}>/);
  });

  it("links the landing to the same sample path the rewrite serves", () => {
    const meta = readFileSync(path.join(ROOT_DIR, "client/src/constants/resumeReportSampleMeta.ts"), "utf8");
    expect(meta).toContain('RESUME_REPORT_SAMPLE_PATH = "/report-new?sample=1"');
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
