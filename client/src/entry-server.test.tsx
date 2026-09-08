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

  it("renders the landing, not the 404 fallback, for the root path", () => {
    const html = render("/");
    expect(html).not.toContain("404");
    expect(html).toContain("<h1");
  });
});
