import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 랜딩 첫 방문 로딩 속도 회귀 방지.
// - static Pretendard CSS는 굵기별로 전체 글리프(~780KB)를 받아 여섯 굵기면 4.7MB가 된다.
//   가변 dynamic-subset은 unicode-range 조각만 받으므로 이 @font-face 묶음을 유지해야 한다.
// - 폰트 CSS를 서드파티 <link>로 걸면 렌더 차단 요청이 origin 하나당 하나씩 늘어난다
//   (모바일 Lighthouse에서 요청당 ~0.9s). 그래서 @font-face는 번들 CSS에 넣고 woff2만 CDN에서 받는다.
// - Inter는 폰트 스택에서 'Pretendard Variable' 뒤에 있고 Pretendard가 라틴 글리프를 갖고 있어
//   실제로 한 번도 내려받지 않던 죽은 렌더 차단 요청이었다.
const CLIENT_DIR = path.resolve(__dirname, "..");
const indexHtml = readFileSync(path.join(CLIENT_DIR, "index.html"), "utf8");
const indexCss = readFileSync(path.join(CLIENT_DIR, "src", "index.css"), "utf8");
const mainTsx = readFileSync(path.join(CLIENT_DIR, "src", "main.tsx"), "utf8");
const fontCss = readFileSync(
  path.join(CLIENT_DIR, "src", "fonts", "pretendard-variable-dynamic-subset.css"),
  "utf8"
);

describe("landing fonts", () => {
  it("bundles the Pretendard variable dynamic-subset @font-face rules instead of linking a third-party stylesheet", () => {
    expect(indexHtml).not.toContain("pretendardvariable-dynamic-subset.min.css");
    expect(indexHtml).not.toContain("/static/pretendard.min.css");
    // jsdelivr는 woff2용 preconnect만 남기고, 스타일시트 <link>는 걸지 않는다.
    expect(indexHtml).not.toMatch(/<link[^>]*rel="stylesheet"[^>]*cdn\.jsdelivr\.net/);
    expect(indexHtml).toContain('<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />');
    expect(mainTsx).toContain('import "./fonts/pretendard-variable-dynamic-subset.css"');
  });

  it("keeps the bundled sheet pointing at the variable dynamic-subset woff2 files by absolute URL", () => {
    expect(fontCss).toContain("font-family:'Pretendard Variable'");
    expect(fontCss).toContain("font-weight:45 920");
    expect(fontCss).toContain("font-display:swap");
    expect(fontCss).toContain("/woff2-dynamic-subset/PretendardVariable.subset.");
    // 번들 CSS는 /assets/에서 서빙되므로 상대 경로면 폰트를 못 찾는다.
    expect(fontCss).not.toContain("url(../");
    expect(fontCss).not.toContain("url(./");
  });

  it("does not load Inter from Google Fonts", () => {
    expect(indexHtml).not.toContain("fonts.googleapis.com");
    expect(indexHtml).not.toContain("fonts.gstatic.com");
  });

  it("uses the 'Pretendard Variable' family name that the dynamic subset CSS declares", () => {
    expect(indexCss).toContain("'Pretendard Variable'");
    expect(indexCss).not.toMatch(/'Pretendard',/);
  });
});
