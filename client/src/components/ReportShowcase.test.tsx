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
  createWheelGestureTracker,
  getReportPreviewWheelAction,
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

  it("pins the page, then flips one scene per wheel gesture", () => {
    const action = (
      offset: number,
      deltaY: number,
      activeIndex: number,
      gestureConsumed = false
    ) =>
      getReportPreviewWheelAction({
        offset,
        deltaY,
        activeIndex,
        gestureConsumed,
      });

    // 평소 스크롤: 아직 자리에 닿지 않았다.
    expect(action(400, 100, 0)).toBe("pass");
    // 이번 휠이면 자리를 지나친다 → 그 자리에 세운다.
    expect(action(60, 100, 0)).toBe("pin");
    // 자리에 서 있으면 페이지 대신 장면을 넘긴다. 같은 동작(관성)은 삼킨다.
    expect(action(0, 100, 0)).toBe("flip");
    expect(action(0, 100, 1, true)).toBe("hold");
    // 마지막 장면에서 내리거나 첫 장면에서 올리면 평소 스크롤로 돌아간다.
    expect(action(0, 100, 3)).toBe("pass");
    expect(action(0, -100, 0)).toBe("pass");
    // 아래에서 올라오며 지나칠 때도 넘길 장면이 남아 있으면 세운다.
    expect(action(-60, -100, 3)).toBe("pin");
    expect(action(-60, -100, 0)).toBe("pass");
  });

  describe("wheel gesture tracker", () => {
    // 트랙패드 한 번 쓸기: 손가락이 가속하는 구간 → 손을 뗀 뒤 줄어드는 관성.
    // Chrome 은 이벤트를 합쳐 보내기도 해서 중간중간 값이 두 배로 튄다.
    const accelerate = [
      2, 5, 9, 14, 20, 38, 27, 33, 40, 46, 90, 52, 58, 62, 66,
    ];
    const momentum = [
      64, 61, 118, 57, 54, 51, 96, 47, 44, 41, 38, 70, 35, 32, 30, 28, 52, 25,
      23, 21, 19, 18, 34, 16, 15, 14, 13, 12, 22, 11, 10, 9, 8, 14, 7, 6, 5, 4,
      8, 3, 3, 2, 2, 4, 1, 1,
    ];

    const createFeeder = () => {
      const tracker = createWheelGestureTracker();
      let now = 0;
      return {
        tracker,
        wait: (ms: number) => {
          now += ms;
        },
        // 새 동작으로 판정되면 바로 장면을 넘겼다고(consume) 치고, 넘긴 횟수를 센다.
        feed: (deltas: number[]) =>
          deltas.reduce((flips, delta) => {
            now += 16;
            if (!tracker.register(delta, now)) return flips;
            tracker.consume(now);
            return flips + 1;
          }, 0),
      };
    };

    it("counts one long swipe with jittery momentum as a single gesture", () => {
      const { feed } = createFeeder();
      expect(feed([...accelerate, ...momentum])).toBe(1);
    });

    it("treats a second swipe during momentum as a new gesture", () => {
      const { feed } = createFeeder();
      // 관성이 반쯤 줄었을 때 다시 쓸었다(틈 없음).
      expect(
        feed([...accelerate, ...momentum.slice(0, 26), ...accelerate])
      ).toBe(2);
    });

    it("treats a wheel after a pause as a new gesture", () => {
      const { feed, wait } = createFeeder();
      expect(feed([100])).toBe(1);
      wait(400);
      expect(feed([100])).toBe(1);
    });
  });

  it("turns a wheel into a scene flip without scrolling the page once pinned", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal("scrollTo", vi.fn());

    render(<ReportShowcase />);

    const block = document.querySelector("[data-report-preview-block]");
    if (!block) throw new Error("Report preview block was not found");

    // 블록 높이 0(jsdom) → 제자리 = 사이트 헤더 57px + 남는 높이의 절반.
    const pinnedTop = 57 + (window.innerHeight - 57) / 2;
    vi.spyOn(block, "getBoundingClientRect").mockReturnValue({
      bottom: pinnedTop,
      height: 0,
      left: 0,
      right: 1000,
      toJSON: () => ({}),
      top: pinnedTop,
      width: 1000,
      x: 0,
      y: pinnedTop,
    });

    await waitFor(() => {
      const event = new WheelEvent("wheel", { cancelable: true, deltaY: 100 });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });
    await waitFor(() =>
      expect(screen.getByText("우선 보완 순서")).toBeTruthy()
    );
    expect(window.scrollTo).not.toHaveBeenCalled();
    // 휠 preventDefault 만으로는 트랙패드 관성을 못 막으므로 페이지 스크롤 자체를 잠근다.
    expect(document.documentElement.style.overflow).toBe("hidden");

    // 마지막 장면까지 넘긴 뒤 한 번 더 내리면 잠금을 풀어 평소 스크롤로 돌려보낸다.
    // 실제 시계보다 앞선 시각으로 흉내 낸다(전체 실행에선 performance.now() 가 이미 수십 초를 넘는다).
    const startedAt = performance.now();
    const nowSpy = vi.spyOn(performance, "now");
    [10_000, 20_000, 30_000].forEach((offset, index) => {
      nowSpy.mockReturnValue(startedAt + offset);
      const event = new WheelEvent("wheel", { cancelable: true, deltaY: 100 });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      // 풀어 주는 휠(세 번째)은 잠긴 채 도착해 헛돌지 않도록 그만큼 직접 내려 준다.
      expect(window.scrollTo).toHaveBeenCalledTimes(index === 2 ? 1 : 0);
    });
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("pins the page even when the wheel event cannot be cancelled", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.stubGlobal("scrollTo", vi.fn());

    render(<ReportShowcase />);

    const block = document.querySelector("[data-report-preview-block]");
    if (!block) throw new Error("Report preview block was not found");

    const pinnedTop = 57 + (window.innerHeight - 57) / 2;
    let top = pinnedTop + 40;
    vi.spyOn(block, "getBoundingClientRect").mockImplementation(
      () => ({ top }) as DOMRect
    );

    // 트랙패드로 쭉 내리는 중간 이벤트: 취소 불가, 이번 이동으로는 아직 자리에 안 닿는다.
    await waitFor(() => {
      window.dispatchEvent(
        new WheelEvent("wheel", { cancelable: false, deltaY: 10 })
      );
      window.dispatchEvent(new Event("scroll"));
      expect(document.documentElement.style.overflow).toBe("");
    });

    // 관성으로 자리를 30px 지나쳐 버렸다 → 스크롤 위치로 감지해 되돌려 세우고 잠근다.
    top = pinnedTop - 30;
    window.dispatchEvent(
      new WheelEvent("wheel", { cancelable: false, deltaY: 10 })
    );
    window.dispatchEvent(new Event("scroll"));

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(window.scrollTo).toHaveBeenCalled();
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
  });
});
