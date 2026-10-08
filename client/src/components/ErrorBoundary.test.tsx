// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { capturePrerenderedHtml, resetPrerenderedHtml } from "@/lib/prerenderedSnapshot";
import ErrorBoundary from "./ErrorBoundary";

const CHUNK_ERROR = new TypeError(
  "Failed to fetch dynamically imported module: https://pre-view.me/assets/GuideArticle-abc123.js"
);

function Thrower({ error }: { error: Error }): null {
  throw error;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    resetPrerenderedHtml();
    // React 가 잡힌 에러를 console.error 로 한 번 더 찍는다. 테스트 출력만 조용히 한다.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("restores the prerendered HTML when a lazy chunk fails to load", () => {
    const root = document.createElement("div");
    root.innerHTML = "<article><h1>자소서 성장과정</h1><p>프리렌더 본문</p></article>";
    capturePrerenderedHtml(root);
    const reload = vi.fn();

    render(
      <ErrorBoundary reload={reload}>
        <Thrower error={CHUNK_ERROR} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: "자소서 성장과정" })).toBeTruthy();
    // 같은 페이지(검색 엔진이 처음 연 페이지)면 새로 불러오지 않고 본문을 지킨다
    expect(reload).not.toHaveBeenCalled();
    expect(screen.queryByText("일시적인 오류가 발생했어요")).toBeNull();
  });

  it("reloads the page once for a chunk failure when nothing was prerendered for this URL", () => {
    window.sessionStorage.clear();
    const reload = vi.fn();
    render(
      <ErrorBoundary reload={reload}>
        <Thrower error={CHUNK_ERROR} />
      </ErrorBoundary>
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("일시적인 오류가 발생했어요")).toBeNull();
  });

  it("shows the error screen for other errors even on a prerendered page", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>프리렌더 본문</p>";
    capturePrerenderedHtml(root);

    render(
      <ErrorBoundary>
        <Thrower error={new Error("boom")} />
      </ErrorBoundary>
    );
    expect(screen.getByText("일시적인 오류가 발생했어요")).toBeTruthy();
    expect(screen.queryByText("프리렌더 본문")).toBeNull();
  });

  describe("배포가 바뀐 뒤 다른 화면으로 넘어가다 청크를 못 받으면", () => {
    beforeEach(() => {
      window.sessionStorage.clear();
      window.history.pushState({}, "", "/");
    });
    afterEach(() => window.history.pushState({}, "", "/"));

    it("처음 연 페이지(홈)의 저장본을 그리지 않고, 그 주소를 한 번 새로 불러온다", () => {
      const root = document.createElement("div");
      root.innerHTML = "<h1>홈 프리렌더</h1>";
      capturePrerenderedHtml(root, "/");
      window.history.pushState({}, "", "/analysis-pending?requestId=r1");
      const reload = vi.fn();

      render(
        <ErrorBoundary reload={reload}>
          <Thrower error={CHUNK_ERROR} />
        </ErrorBoundary>
      );

      expect(screen.queryByText("홈 프리렌더")).toBeNull();
      expect(reload).toHaveBeenCalledTimes(1);
    });

    it("방금 새로 불러왔는데도 또 실패하면 다시 불러오지 않고 오류 화면을 보여 준다", () => {
      window.history.pushState({}, "", "/analysis-pending?requestId=r1");
      const reload = vi.fn();
      render(
        <ErrorBoundary reload={reload}>
          <Thrower error={CHUNK_ERROR} />
        </ErrorBoundary>
      );
      cleanup();
      render(
        <ErrorBoundary reload={reload}>
          <Thrower error={CHUNK_ERROR} />
        </ErrorBoundary>
      );

      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.getByText("일시적인 오류가 발생했어요")).toBeTruthy();
    });
  });
});
