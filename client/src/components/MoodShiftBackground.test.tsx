import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import MoodShiftBackground from "./MoodShiftBackground";

describe("MoodShiftBackground", () => {
  it("hangs no live SVG reference filter over the full-screen layer", () => {
    // 전체 화면 변위 필터(feTurbulence → feDisplacementMap)는 브라우저가 CPU 로 그린다.
    // 이 배경 레이어 안에는 blur 먹인 글로우 5개와 매 프레임 다시 쓰이는 커서 그라데이션이 있어
    // 필터 입력이 매 프레임 바뀌고, 그래서 결과가 캐시되지 않는다.
    // 폰은 09-09 에 (hover)/(pointer) 미디어쿼리로 껐지만, 창이 큰 데스크톱이 오히려 픽셀이 많아
    // 1756×1609@2x 에서 배경이 깜빡이고 스크롤이 밀렸다(09-27). 그래서 기기를 가리지 않고 걸지 않는다.
    // 노이즈 그레인은 data: URI 배경 이미지라 한 번만 래스터되므로 이 규칙 대상이 아니다.
    const html = renderToString(<MoodShiftBackground />);
    expect(html).not.toContain("<filter");
    expect(html).not.toContain("<feDisplacementMap");
    expect(html).not.toContain("filter:url(");
    expect(html).not.toContain("mood-shift-wobble");

    const css = readFileSync(
      path.resolve(import.meta.dirname, "../styles/landing.css"),
      "utf8"
    );
    expect(css).not.toContain("mood-shift-wobble");
  });
});
