// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// public/landing-boot.js 는 번들 밖의 일반 스크립트라 여기서 소스를 읽어 실행한다.
const BOOT = readFileSync(path.resolve(import.meta.dirname, "../public/landing-boot.js"), "utf8");

function runBoot() {
  new Function(BOOT)();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
});

describe("landing-boot", () => {
  it("evaluates the preloaded entry bundle only after the first frame plus the entrance animation", () => {
    document.head.innerHTML =
      '<link rel="modulepreload" crossorigin href="/assets/index-abc.js" data-entry>';
    runBoot();
    expect(document.querySelector("script[type=module]")).toBeNull();
    vi.advanceTimersByTime(16 + 1100);
    expect(document.querySelector("script[type=module]")).toBeNull();
    vi.advanceTimersByTime(200);
    const script = document.querySelector<HTMLScriptElement>("script[type=module]")!;
    expect(script.src).toBe("http://localhost:3000/assets/index-abc.js");
    expect(script.crossOrigin).toBe("anonymous");
    // 5초 안전장치가 두 번째 스크립트를 만들지 않는다
    vi.advanceTimersByTime(5000);
    expect(document.querySelectorAll("script[type=module]")).toHaveLength(1);
  });

  it("still starts within 5s when requestAnimationFrame never fires (background tab)", () => {
    document.head.innerHTML =
      '<link rel="modulepreload" crossorigin href="/assets/index-abc.js" data-entry>';
    vi.stubGlobal("requestAnimationFrame", () => 0);
    runBoot();
    vi.advanceTimersByTime(4999);
    expect(document.querySelector("script[type=module]")).toBeNull();
    vi.advanceTimersByTime(1);
    expect(document.querySelector("script[type=module]")).not.toBeNull();
  });

  it("does nothing on pages without the deferred entry (app.html, dev)", () => {
    runBoot();
    vi.advanceTimersByTime(10000);
    expect(document.querySelector("script[type=module]")).toBeNull();
  });
});
