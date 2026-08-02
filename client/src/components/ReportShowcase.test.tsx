// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReportShowcase, {
  getBoundedReportPreviewSceneIndex,
  getReportPreviewSceneIndex,
} from "./ReportShowcase";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ReportShowcase", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("maps each scroll phase to its report scene", () => {
    expect(
      [0, 0.199, 0.2, 0.4, 0.6, 1].map(getReportPreviewSceneIndex)
    ).toEqual([0, 0, 1, 2, 3, 3]);
  });

  it("moves through no more than one report scene for a scroll update", () => {
    expect(getBoundedReportPreviewSceneIndex(0, 0.8)).toBe(1);
    expect(getBoundedReportPreviewSceneIndex(3, 0.1)).toBe(2);
  });

  it("keeps desktop wheel scrolling native while the preview is pinned", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal("scrollTo", vi.fn());

    render(<ReportShowcase />);

    const frame = screen
      .getAllByRole("img", { name: "Pre:View" })
      .find(brand => brand.parentElement?.textContent?.includes("Report Preview"))
      ?.closest(".rounded-xl");
    const scrollTrack =
      frame?.parentElement?.parentElement?.parentElement?.parentElement;

    if (!scrollTrack)
      throw new Error("Report preview scroll track was not found");

    Object.defineProperty(scrollTrack, "offsetHeight", {
      configurable: true,
      value: 5000,
    });
    vi.spyOn(scrollTrack, "getBoundingClientRect").mockReturnValue({
      bottom: 5000,
      height: 5000,
      left: 0,
      right: 1000,
      toJSON: () => ({}),
      top: 0,
      width: 1000,
      x: 0,
      y: 0,
    });

    await waitFor(() => {
      const event = new WheelEvent("wheel", {
        cancelable: true,
        deltaY: 160,
      });

      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(false);
    });
  });

  it("shows enriched report details as visitors advance through scenes", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));

    render(<ReportShowcase />);
    expect(screen.getByText("지원자 프로필")).toBeTruthy();
    expect(
      screen.getByText(
        "지원자는 데이터로 고객의 이탈 원인을 좁히고, 실험 결과를 다음 개선안에 반영하는 방식에 익숙합니다."
      )
    ).toBeTruthy();
    expect(screen.getByText("현직자 코멘트")).toBeTruthy();
    expect(
      screen.getByText("스크롤하면 핵심 진단으로 이어집니다")
    ).toBeTruthy();

    const next = () =>
      fireEvent.click(
        screen.getAllByRole("button", { name: "다음 리포트 미리보기" })[0]
      );

    next();
    await waitFor(() =>
      expect(screen.getByText("우선 보완 순서")).toBeTruthy()
    );
    next();
    await waitFor(() =>
      expect(
        screen.getByText("고객군을 나눈 기준을 문장 안에 넣어야 합니다.")
      ).toBeTruthy()
    );
    expect(
      screen.getByText(
        "분석 기준이 보이면, 성과가 재현 가능한 판단으로 읽힙니다."
      )
    ).toBeTruthy();
    next();
    await waitFor(() =>
      expect(screen.getAllByText("답변에서 설명할 근거")).toHaveLength(3)
    );
    expect(
      screen.getByText("스크롤하면 다음 섹션으로 이어집니다")
    ).toBeTruthy();
  });
});
