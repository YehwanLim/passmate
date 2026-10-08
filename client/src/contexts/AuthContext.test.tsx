// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, readStoredProfile, useAuth } from "./AuthContext";

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

describe("readStoredProfile", () => {
  const key = "sb-abcdefgh-auth-token";

  beforeEach(() => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // 헤더가 지연 청크·토큰 갱신을 기다리지 않고 프로필을 바로 그리도록, supabase-js 가 남긴 세션을 직접 읽는다.
  it("reads the profile from the session supabase-js stored for this project", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abcdefgh.supabase.co");
    window.localStorage.setItem(
      key,
      JSON.stringify({
        access_token: "expired",
        refresh_token: "refresh",
        user: {
          id: "user-1",
          email: "someone@example.com",
          user_metadata: { full_name: "홍길동", avatar_url: "https://img.example/a.png" },
          app_metadata: { provider: "kakao" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      })
    );

    expect(readStoredProfile()).toMatchObject({
      id: "user-1",
      email: "someone@example.com",
      name: "홍길동",
      profile_image: "https://img.example/a.png",
      provider: "kakao",
    });
  });

  it("returns null when nothing usable is stored", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abcdefgh.supabase.co");
    expect(readStoredProfile()).toBeNull();

    window.localStorage.setItem(key, "not json");
    expect(readStoredProfile()).toBeNull();

    window.localStorage.setItem(key, JSON.stringify({ user: { id: "user-1" } }));
    expect(readStoredProfile()).toBeNull();
  });
});
