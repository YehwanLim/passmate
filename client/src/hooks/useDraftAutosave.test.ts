// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDraftAutosave } from "./useDraftAutosave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDraftAutosave", () => {
  it("입력이 멈추고 delay 뒤 한 번만 저장한다", async () => {
    const save = vi.fn(async () => {});
    const { result, rerender } = renderHook(({ value }) => useDraftAutosave({ value, save, delayMs: 1500, enabled: true }), {
      initialProps: { value: "a" },
    });
    rerender({ value: "ab" });
    rerender({ value: "abc" });
    expect(result.current.state).toBe("pending");
    await act(async () => { vi.advanceTimersByTime(1499); });
    expect(save).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("abc");
    expect(result.current.state).toBe("saved");
  });

  it("처음 불러온 값과 같은 값은 보내지 않는다", async () => {
    const save = vi.fn(async () => {});
    const { rerender } = renderHook(({ value, enabled }) => useDraftAutosave({ value, save, enabled }), {
      initialProps: { value: "loaded", enabled: false },
    });
    rerender({ value: "loaded", enabled: true });
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(save).not.toHaveBeenCalled();
  });

  it("baseline 이 있으면 그 값과 비교해 처음 값도 저장한다", async () => {
    const save = vi.fn(async () => {});
    renderHook(({ value }) => useDraftAutosave({ value, save, enabled: true, baseline: [] as string[] }), {
      initialProps: { value: ["a"] },
    });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(save).toHaveBeenCalledWith(["a"]);
  });

  it("충돌이면 conflict, 그 밖의 실패는 error", async () => {
    const conflict = new Error("STALE_DRAFT");
    const save = vi.fn(async () => { throw conflict; });
    const { result, rerender } = renderHook(({ value }) => useDraftAutosave({
      value, save, enabled: true, isConflict: (e) => e === conflict,
    }), { initialProps: { value: "a" } });
    rerender({ value: "b" });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.state).toBe("conflict");

    save.mockImplementation(async () => { throw new Error("network"); });
    rerender({ value: "c" });
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(result.current.state).toBe("error");
  });
});
