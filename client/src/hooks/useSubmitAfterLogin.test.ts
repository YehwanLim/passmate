// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useSubmitAfterLogin } from "./useSubmitAfterLogin";

function setup(initialAuthenticated = false) {
  const onSubmit = vi.fn();
  const hook = renderHook(
    ({ isAuthenticated }) => useSubmitAfterLogin({ isAuthenticated, onSubmit }),
    { initialProps: { isAuthenticated: initialAuthenticated } },
  );
  return { ...hook, onSubmit };
}

describe("useSubmitAfterLogin", () => {
  it("분석 시작을 눌러 둔(arm) 상태에서 로그인되면 제출을 한 번 부른다", () => {
    const { result, rerender, onSubmit } = setup();

    act(() => result.current.arm());
    rerender({ isAuthenticated: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender({ isAuthenticated: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("누른 적이 없으면 로그인돼도 제출하지 않는다 (다른 탭 로그인, 헤더 로그인)", () => {
    const { rerender, onSubmit } = setup();

    rerender({ isAuthenticated: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("모달을 닫으면(disarm) 나중에 로그인돼도 제출하지 않는다", () => {
    const { result, rerender, onSubmit } = setup();

    act(() => result.current.arm());
    act(() => result.current.disarm());
    rerender({ isAuthenticated: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("처음부터 arm 된 채 마운트돼도(카카오 왕복 복귀) 세션이 확인되는 순간 한 번 제출한다", () => {
    const onSubmit = vi.fn();
    const { rerender } = renderHook(
      ({ isAuthenticated }) => useSubmitAfterLogin({ isAuthenticated, onSubmit, initiallyArmed: true }),
      { initialProps: { isAuthenticated: false } },
    );

    expect(onSubmit).not.toHaveBeenCalled();
    rerender({ isAuthenticated: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("가장 최근 onSubmit 을 부른다 (폼 상태를 닫아 둔 최신 클로저)", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ isAuthenticated, onSubmit }) => useSubmitAfterLogin({ isAuthenticated, onSubmit }),
      { initialProps: { isAuthenticated: false, onSubmit: first } },
    );

    act(() => result.current.arm());
    rerender({ isAuthenticated: false, onSubmit: second });
    rerender({ isAuthenticated: true, onSubmit: second });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
