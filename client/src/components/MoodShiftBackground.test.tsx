import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import MoodShiftBackground from "./MoodShiftBackground";

describe("MoodShiftBackground", () => {
  it("does not animate the turbulence with SMIL", () => {
    // feTurbulence 의 baseFrequency 를 <animate> 로 계속 바꾸면 WebKit 이 전체 화면 displacement 필터를
    // 매 프레임 다시 그려 GPU 프로세스가 유휴 상태에서도 CPU 200%+ 를 쓴다(데스크톱 Safari 측정).
    // 폰에서는 그 부하가 JS 실행·타일 페인트를 밀어내 하이드레이션이 늦어지고 스크롤 중 흰 타일이 보였다.
    const html = renderToString(<MoodShiftBackground />);
    expect(html).toContain("<feTurbulence");
    expect(html).not.toContain("<animate");
  });

  it("applies the wobble filter through the pointer-gated CSS class, never inline", () => {
    // 인라인 filter 는 프리렌더 HTML 에 실려 iPhone 이 전체 화면을 CPU 로 필터링한다(첫 화면 5초, 빈 타일).
    // index.css 가 (hover: hover) and (pointer: fine) 안에서만 거는 클래스로 대신한다.
    const html = renderToString(<MoodShiftBackground />);
    expect(html).not.toContain("filter:url(");
    expect(html).toContain("mood-shift-wobble\"");
    const css = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");
    const gated = css.match(/@media \(hover: hover\) and \(pointer: fine\) \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(gated).toContain(".mood-shift-wobble");
    expect(gated).toContain("filter: url(#mood-shift-wobble)");
  });

});
