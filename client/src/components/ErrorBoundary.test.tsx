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

    render(
      <ErrorBoundary>
        <Thrower error={CHUNK_ERROR} />
      </ErrorBoundary>
    );

    expect(screen.getByRole("heading", { name: "자소서 성장과정" })).toBeTruthy();
    expect(screen.queryByText("일시적인 오류가 발생했어요")).toBeNull();
  });

  it("shows the error screen for a chunk failure when nothing was prerendered", () => {
    render(
      <ErrorBoundary>
        <Thrower error={CHUNK_ERROR} />
      </ErrorBoundary>
    );
    expect(screen.getByText("일시적인 오류가 발생했어요")).toBeTruthy();
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
});
