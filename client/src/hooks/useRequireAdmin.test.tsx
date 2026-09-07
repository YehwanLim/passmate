// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  navigate: vi.fn(),
  adminApiFetch: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/admin", mocks.navigate] }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/adminApi", () => ({
  adminApiFetch: mocks.adminApiFetch,
  AdminApiError: class AdminApiError extends Error {
    status: number;
    constructor(status: number) {
      super("admin api error");
      this.status = status;
    }
  },
}));

import { useRequireAdmin } from "./useRequireAdmin";

describe("useRequireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminApiFetch.mockResolvedValue({ role: "admin" });
  });

  afterEach(() => cleanup());

  it("verifies the role once and keeps the admin state when the session object is rebuilt for the same user", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" }, isLoading: false });
    const { result, rerender } = renderHook(() => useRequireAdmin());

    await waitFor(() => expect(result.current.roleState).toBe("admin"));
    expect(mocks.adminApiFetch).toHaveBeenCalledTimes(1);

    // Supabase 세션 이벤트(탭 복귀·토큰 갱신)는 같은 사용자의 새 객체를 만든다.
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" }, isLoading: false });
    rerender();

    expect(result.current.roleState).toBe("admin");
    expect(mocks.adminApiFetch).toHaveBeenCalledTimes(1);
  });

  it("re-verifies when a different user signs in", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" }, isLoading: false });
    const { result, rerender } = renderHook(() => useRequireAdmin());
    await waitFor(() => expect(result.current.roleState).toBe("admin"));

    mocks.adminApiFetch.mockResolvedValue({ role: "user" });
    mocks.useAuth.mockReturnValue({ user: { id: "user-2" }, isLoading: false });
    rerender();

    await waitFor(() => expect(result.current.roleState).toBe("forbidden"));
    expect(mocks.adminApiFetch).toHaveBeenCalledTimes(2);
  });

  it("sends a signed-out visitor to the admin login and forgets the verified user", async () => {
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" }, isLoading: false });
    const { result, rerender } = renderHook(() => useRequireAdmin());
    await waitFor(() => expect(result.current.roleState).toBe("admin"));

    mocks.useAuth.mockReturnValue({ user: null, isLoading: false });
    rerender();

    expect(result.current.roleState).toBe("unauthenticated");
    expect(mocks.navigate).toHaveBeenCalledWith("/admin/login");

    // 다시 같은 사용자가 로그인하면 서버에 한 번 더 확인한다.
    mocks.useAuth.mockReturnValue({ user: { id: "user-1" }, isLoading: false });
    rerender();
    await waitFor(() => expect(mocks.adminApiFetch).toHaveBeenCalledTimes(2));
  });
});
