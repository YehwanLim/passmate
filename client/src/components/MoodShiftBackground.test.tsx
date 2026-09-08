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
});
