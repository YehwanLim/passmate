import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 랜딩 첫 방문 로딩 속도 회귀 방지.
// static Pretendard CSS는 굵기별로 전체 글리프(~780KB)를 받아 여섯 굵기면 4.7MB가 된다.
// 가변 dynamic-subset은 unicode-range 조각(~35KB)만 받으므로 이 링크를 유지해야 한다.
const CLIENT_DIR = path.resolve(__dirname, "..");
const indexHtml = readFileSync(path.join(CLIENT_DIR, "index.html"), "utf8");
const indexCss = readFileSync(path.join(CLIENT_DIR, "src", "index.css"), "utf8");

describe("landing fonts", () => {
  it("loads Pretendard as the variable dynamic subset, not the static full-glyph files", () => {
    expect(indexHtml).toContain("pretendardvariable-dynamic-subset.min.css");
    expect(indexHtml).not.toContain("/static/pretendard.min.css");
  });

  it("uses the 'Pretendard Variable' family name that the dynamic subset CSS declares", () => {
    expect(indexCss).toContain("'Pretendard Variable'");
    expect(indexCss).not.toMatch(/'Pretendard',/);
  });
});
