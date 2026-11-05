// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ENGAGED_TIME_KEY, startEngagedTimeTracking } from "./engagedTime";

let visibility: DocumentVisibilityState = "visible";
let clock = 0;
let stop: (() => void) | null = null;
const send = vi.fn();

function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

function start() {
  stop = startEngagedTimeTracking({ send, now: () => clock, storage: window.sessionStorage });
}

describe("startEngagedTimeTracking", () => {
  beforeEach(() => {
    visibility = "visible";
    clock = 1_000_000;
    send.mockReset();
    window.sessionStorage.clear();
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  });

  afterEach(() => {
    stop?.();
    stop = null;
  });

  it("탭을 떠날 때 보이던 시간을 초로 보낸다", () => {
    start();
    clock += 12_500;
    setVisibility("hidden");

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(12);
  });

  it("안 보이던 시간은 세지 않고, 돌아오면 이어서 누적한다", () => {
    start();
    clock += 10_000;
    setVisibility("hidden");
    clock += 3_600_000;
    setVisibility("visible");
    clock += 5_000;
    window.dispatchEvent(new Event("pagehide"));

    expect(send.mock.calls.map(([seconds]) => seconds)).toEqual([10, 15]);
  });

  it("백그라운드에서 열린 탭은 보이기 전까지 재지 않는다", () => {
    visibility = "hidden";
    start();
    clock += 60_000;
    setVisibility("visible");
    clock += 4_000;
    setVisibility("hidden");

    expect(send).toHaveBeenCalledWith(4);
  });

  it("1초도 안 본 방문은 보내지 않는다", () => {
    start();
    clock += 400;
    setVisibility("hidden");

    expect(send).not.toHaveBeenCalled();
  });

  it("탭을 자주 오가도 1분에 한 번만 보내고, 페이지를 닫을 때는 바로 보낸다", () => {
    start();
    for (let turn = 0; turn < 5; turn += 1) {
      clock += 3_000;
      setVisibility("hidden");
      setVisibility("visible");
    }
    expect(send.mock.calls.map(([seconds]) => seconds)).toEqual([3]);

    clock += 3_000;
    window.dispatchEvent(new Event("pagehide"));
    expect(send.mock.calls.map(([seconds]) => seconds)).toEqual([3, 18]);
  });

  it("같은 값은 다시 보내지 않는다(화면 전환 뒤 pagehide 가 따라올 때)", () => {
    start();
    clock += 8_000;
    setVisibility("hidden");
    window.dispatchEvent(new Event("pagehide"));

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("전체 새로고침을 넘어 누적값을 잇는다", () => {
    start();
    clock += 20_000;
    window.dispatchEvent(new Event("pagehide"));
    stop?.();
    expect(window.sessionStorage.getItem(ENGAGED_TIME_KEY)).toBe("20000");

    start();
    clock += 5_000;
    setVisibility("hidden");
    expect(send).toHaveBeenLastCalledWith(25);
  });

  it("트리가 다시 마운트돼도(stop 후 start) 그때까지 잰 시간을 잃지 않는다", () => {
    start();
    clock += 7_000;
    stop?.();
    start();
    clock += 2_000;
    setVisibility("hidden");

    expect(send).toHaveBeenCalledWith(9);
  });

  it("멈춘 뒤에는 이벤트를 듣지 않는다", () => {
    start();
    clock += 5_000;
    stop?.();
    stop = null;
    setVisibility("hidden");

    expect(send).not.toHaveBeenCalled();
  });
});
