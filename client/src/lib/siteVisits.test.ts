import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VISITOR_ID_KEY,
  getVisitorId,
  resetVisitorIdForTests,
  sendVisit,
  shouldTrackPath,
} from "./siteVisits";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => { map.delete(key); },
    setItem: (key, value) => { map.set(key, value); },
  };
}

describe("siteVisits", () => {
  beforeEach(() => resetVisitorIdForTests());
  afterEach(() => vi.restoreAllMocks());

  it("관리자 경로는 방문으로 세지 않는다", () => {
    expect(shouldTrackPath("/")).toBe(true);
    expect(shouldTrackPath("/analyze")).toBe(true);
    expect(shouldTrackPath("/admin")).toBe(false);
    expect(shouldTrackPath("/admin/users")).toBe(false);
    expect(shouldTrackPath("relative")).toBe(false);
  });

  it("방문자 ID 는 세션 스토리지에 한 번 만들고 재사용한다", () => {
    const storage = memoryStorage();
    const first = getVisitorId(storage);
    resetVisitorIdForTests();
    const second = getVisitorId(storage);

    expect(first).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(second).toBe(first);
    expect(storage.getItem(VISITOR_ID_KEY)).toBe(first);
  });

  it("스토리지가 막혀 있어도 메모리 ID 로 동작한다", () => {
    const broken = {
      ...memoryStorage(),
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    } as Storage;

    expect(getVisitorId(broken)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });

  it("경로와 방문자 ID 만 보내고, 로그인 토큰이 있으면 Authorization 을 붙인다", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response(JSON.stringify({ recorded: true }), { status: 200 });
    };

    const ok = await sendVisit("/analyze", {
      fetcher,
      getAccessToken: async () => "token-1",
      visitorId: "8c4d2a70-3b1e-4d5f-9a6b-2c1d0e9f8a7b",
    });

    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    const [url, init] = calls[0];
    expect(url).toBe("/api/visits");
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer token-1" }));
    expect(JSON.parse(String(init?.body))).toEqual({
      visitorId: "8c4d2a70-3b1e-4d5f-9a6b-2c1d0e9f8a7b",
      path: "/analyze",
    });
  });

  it("비로그인이면 Authorization 없이 보내고, 네트워크 실패는 삼킨다", async () => {
    let seenHeaders: HeadersInit | undefined;
    const okFetcher: typeof fetch = async (_input, init) => {
      seenHeaders = init?.headers;
      return new Response("{}", { status: 200 });
    };
    await sendVisit("/", { fetcher: okFetcher, getAccessToken: async () => null, visitorId: "visitor-1234" });
    expect(seenHeaders).not.toHaveProperty("Authorization");

    const failing: typeof fetch = async () => { throw new Error("offline"); };
    await expect(
      sendVisit("/", { fetcher: failing, getAccessToken: async () => null, visitorId: "visitor-1234" }),
    ).resolves.toBe(false);
  });

  it("관리자 경로는 요청 자체를 보내지 않는다", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const ok = await sendVisit("/admin/dashboard", { fetcher, getAccessToken: async () => null, visitorId: "visitor-1234" });

    expect(ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("siteVisits bundle boundary", () => {
  // App → VisitTracker → siteVisits 는 랜딩 진입 청크에 포함된다. 여기서 Supabase 클라이언트를
  // 정적으로 import 하면 @supabase/* 전체(gzip ~55KB)가 첫 화면 JS 에 도로 들어간다.
  it("loads the Supabase client lazily instead of importing it statically", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(path.resolve(__dirname, "siteVisits.ts"), "utf8");
    expect(source).not.toMatch(/^import\s+\{[^}]*supabase[^}]*\}\s+from\s+"@\/lib\/supabase"/m);
    expect(source).toContain('import("@/lib/supabase")');
  });
});
