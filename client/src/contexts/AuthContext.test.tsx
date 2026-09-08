// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

const mocks = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("@/lib/analytics", () => ({ trackLogin: vi.fn(), trackSignUp: vi.fn() }));

// jsdom 환경에서는 import.meta.url이 http 스킴이라 path로 읽는다.
const authContextSource = readFileSync(
  path.resolve(__dirname, "AuthContext.tsx"),
  "utf8"
);

function Probe() {
  const { isLoading, isAuthenticated, user } = useAuth();
  if (isLoading) return <p>loading</p>;
  return <p>{isAuthenticated ? `signed-in:${user?.email}` : "anonymous"}</p>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  // 랜딩 진입 번들에서 @supabase/* (소스 기준 ~840KB)를 빼기 위해 클라이언트를 지연 로드한다.
  // 정적 import가 다시 들어오면 Rollup이 supabase를 진입 청크로 도로 합친다.
  it("does not import the Supabase client statically", () => {
    expect(authContextSource).not.toMatch(/^import\s+\{[^}]*supabase[^}]*\}\s+from\s+"@\/lib\/supabase"/m);
    expect(authContextSource).toContain('import("@/lib/supabase")');
  });

  it("resolves an anonymous visitor once the lazily loaded client reports no session", async () => {
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("anonymous")).toBeTruthy());
    expect(mocks.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it("restores the profile when the client emits an existing session", async () => {
    mocks.onAuthStateChange.mockImplementation(callback => {
      callback("INITIAL_SESSION", {
        user: {
          id: "user-1",
          email: "someone@example.com",
          user_metadata: {},
          app_metadata: { provider: "google" },
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-02-01T00:00:00.000Z",
        },
      });
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByText("signed-in:someone@example.com")).toBeTruthy()
    );
  });

  it("unsubscribes from auth changes on unmount even though the client arrived asynchronously", async () => {
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    const { unmount } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText("anonymous")).toBeTruthy());

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
