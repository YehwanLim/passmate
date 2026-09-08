import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "./entry-server";

// 빌드 시점 프리렌더(scripts/prerender-landing.mjs)가 쓰는 렌더 함수.
// 랜딩 컴포넌트가 렌더 중에 window/document를 읽기 시작하면 여기서 먼저 깨진다.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("entry-server render", () => {
  it("renders the landing page to HTML in node without console errors", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const html = render("/");

    expect(html.length).toBeGreaterThan(10_000);
    expect(html).toContain("10초면");
    expect(html).toContain("서비스 소개");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not bake invisible entrance states into the prerendered landing", () => {
    // framer-motion 의 initial 은 SSR 에서 인라인 opacity:0 / scale(0) 으로 구워진다. 그러면 본문이
    // HTML 에 있어도 JS 가 하이드레이션해 애니메이션을 돌릴 때까지 투명하다(폰에서 h1 만 5초).
    // 첫 화면 등장은 CSS 키프레임(index.css .landing-rise)으로, 아래 섹션은 등장 효과 없이 바로 보이게 둔다.
    const html = render("/");
    expect(html).not.toMatch(/opacity:\s*0[;"]/);
    // 유일하게 허용하는 scale(0) 은 화면 맨 위 1px 스크롤 진행 막대(스크롤 0 이라 폭 0 이 맞다).
    expect(html.match(/scale[XY]?\(0\)/g)).toEqual(["scaleX(0)"]);
  });

  it("renders the landing, not the 404 fallback, for the root path", () => {
    const html = render("/");
    expect(html).not.toContain("404");
    expect(html).toContain("<h1");
  });
});
