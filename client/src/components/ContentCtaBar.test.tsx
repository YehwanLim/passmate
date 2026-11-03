// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendFunnelEvent: vi.fn() }));
vi.mock("@/lib/siteVisits", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/siteVisits")>()),
  sendFunnelEvent: mocks.sendFunnelEvent,
}));

import { CONTENT_CTA_BAR_SHOW_AFTER_PX, ContentCtaBar, contentCtaBarText } from "./ContentCtaBar";

function scrollTo(y: number) {
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    window.dispatchEvent(new Event("scroll"));
  });
}

function renderBar() {
  render(
    <>
      <ContentCtaBar company="삼립" href="/analyze?company=%EC%82%BC%EB%A6%BD&job=samlip" where="job-bar:samlip" endId="end" />
      <div id="end" />
    </>
  );
  return screen.getByRole("link", { hidden: true }).parentElement!;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  scrollTo(0);
});

describe("contentCtaBarText", () => {
  it("회사가 있으면 회사 이름, 없으면 '내'로 묻는다", () => {
    expect(contentCtaBarText("삼립")).toBe("삼립 자소서, 이대로 내도 될까요?");
    expect(contentCtaBarText(null)).toBe("내 자소서, 이대로 내도 될까요?");
  });
});

describe("ContentCtaBar", () => {
  it("첫 화면에서는 숨어 있다가 조금 내리면 올라온다", () => {
    const bar = renderBar();
    expect(bar.dataset.visible).toBe("false");
    expect(bar.hasAttribute("inert")).toBe(true);

    // 글 끝 입구는 아직 화면 아래에 있다.
    vi.spyOn(document.getElementById("end")!, "getBoundingClientRect").mockReturnValue({ top: 5000 } as DOMRect);
    scrollTo(CONTENT_CTA_BAR_SHOW_AFTER_PX + 1);
    expect(bar.dataset.visible).toBe("true");
    expect(bar.hasAttribute("inert")).toBe(false);
  });

  it("글 끝 입구가 화면에 들어오면 다시 숨는다", () => {
    const bar = renderBar();
    vi.spyOn(document.getElementById("end")!, "getBoundingClientRect").mockReturnValue({ top: 100 } as DOMRect);
    scrollTo(2000);
    expect(bar.dataset.visible).toBe("false");
  });

  it("누르면 분석 폼으로 가고 위치를 기록한다", () => {
    renderBar();
    const link = screen.getByRole("link", { hidden: true });
    expect(link.getAttribute("href")).toBe("/analyze?company=%EC%82%BC%EB%A6%BD&job=samlip");
    fireEvent.click(link);
    expect(mocks.sendFunnelEvent).toHaveBeenCalledWith("content_cta_click", "job-bar:samlip");
  });
});
