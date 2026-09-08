// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

// 랜딩은 <html> 에 landing-canvas 를 붙여 문서 배경을 검게 한다(index.css). body 가 라이트 테마라
// iOS 오버스크롤·미도색 타일이 흰색으로 비치는 것을 막는 장치이므로, 떠날 때 반드시 떼야 다른 화면이 어두워지지 않는다.
vi.mock("wouter", async importOriginal => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/", vi.fn()],
}));
vi.mock("@/components/AuthButton", () => ({ default: () => null }));
vi.mock("@/components/MoodShiftBackground", () => ({ default: () => null }));

import Home from "./Home";

// jsdom 에는 IntersectionObserver(framer-motion whileInView)와 matchMedia(useMobile 등)가 없어 마운트 중 throw 한다.
class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("landing-canvas");
});

describe("Home landing canvas", () => {
  it("marks the document dark while mounted and restores it on unmount", () => {
    const { unmount } = render(<Home />);
    expect(document.documentElement.classList.contains("landing-canvas")).toBe(true);

    unmount();
    expect(document.documentElement.classList.contains("landing-canvas")).toBe(false);
  });
});
