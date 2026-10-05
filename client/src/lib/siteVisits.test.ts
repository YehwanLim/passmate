import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  VISITOR_ID_KEY,
  deviceClass,
  getVisitorId,
  readEntrySource,
  resetVisitorIdForTests,
  sendClientEvent,
  sendFunnelEvent,
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

  it("유입원은 첫 핑에만 실리고, 같은 사이트 referrer 는 유입원이 아니다", async () => {
    const origin = "https://pre-view.me";
    expect(readEntrySource("https://blog.naver.com/hansi/1?x=1", "?utm_source=blog", origin)).toEqual({
      referrer: "https://blog.naver.com/hansi/1?x=1",
      utmSource: "blog",
    });
    expect(readEntrySource(`${origin}/analyze`, "", origin)).toBeNull();
    expect(readEntrySource("", "?utm_source=bad source", origin)).toBeNull();
    expect(readEntrySource("", "?utm_source=threads", origin)).toEqual({ referrer: null, utmSource: "threads" });

    const bodies: unknown[] = [];
    const fetcher: typeof fetch = async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 200 });
    };
    await sendVisit("/", { fetcher, getAccessToken: async () => null, visitorId: "visitor-1234", source: { referrer: null, utmSource: "threads" } });
    await sendVisit("/analyze", { fetcher, getAccessToken: async () => null, visitorId: "visitor-1234", source: null });
    expect(bodies).toEqual([
      { visitorId: "visitor-1234", path: "/", referrer: null, utmSource: "threads" },
      { visitorId: "visitor-1234", path: "/analyze" },
    ]);
  });

  it("인앱 브라우저 종류는 첫 핑에만 실린다", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetcher: typeof fetch = async (_input, init) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 200 });
    };
    const base = { fetcher, getAccessToken: async () => null, visitorId: "visitor-1234", source: null };

    await sendVisit("/", { ...base, inAppBrowser: "kakaotalk" });
    await sendVisit("/analyze", { ...base, inAppBrowser: null });
    // 기본값(생략)은 한 번만 UA 로 판별한다. 이 테스트 환경(jsdom)은 일반 브라우저라 null 이고, 두 번째부터는 아예 붙지 않는다.
    resetVisitorIdForTests();
    await sendVisit("/", base);
    await sendVisit("/guide", base);

    expect(bodies[0]).toEqual({ visitorId: "visitor-1234", path: "/", inAppBrowser: "kakaotalk" });
    expect(bodies[1]).toEqual({ visitorId: "visitor-1234", path: "/analyze" });
    expect(bodies[2]).toEqual({ visitorId: "visitor-1234", path: "/" });
    expect(bodies[3]).toEqual({ visitorId: "visitor-1234", path: "/guide" });
  });

  it("로그인 화면 이벤트는 같은 엔드포인트에 event 필드로 보내고, 실패는 삼킨다", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return new Response("{}", { status: 200 });
    };

    const ok = await sendClientEvent("google_signin_failed", "Invalid nonce", {
      fetcher,
      getAccessToken: async () => "token-1",
      visitorId: "visitor-1234",
      inAppBrowser: "instagram",
    });

    expect(ok).toBe(true);
    const [url, init] = calls[0];
    expect(url).toBe("/api/visits");
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer token-1" }));
    expect(JSON.parse(String(init?.body))).toEqual({
      visitorId: "visitor-1234",
      event: "google_signin_failed",
      detail: "Invalid nonce",
      inAppBrowser: "instagram",
    });

    const bare = await sendClientEvent("login_prompt_in_app", undefined, {
      fetcher, getAccessToken: async () => null, visitorId: "visitor-1234", inAppBrowser: null,
    });
    expect(bare).toBe(true);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ visitorId: "visitor-1234", event: "login_prompt_in_app" });

    const failing: typeof fetch = async () => { throw new Error("offline"); };
    await expect(
      sendClientEvent("kakao_start_failed", "x", { fetcher: failing, getAccessToken: async () => null, visitorId: "visitor-1234" }),
    ).resolves.toBe(false);
  });

  it("퍼널 이벤트는 detail 에 기기:위치만 싣고, 꺼져 있으면(개발 빌드) 요청을 보내지 않는다", async () => {
    const calls: Array<RequestInit | undefined> = [];
    const fetcher: typeof fetch = async (_input, init) => {
      calls.push(init);
      return new Response("{}", { status: 200 });
    };
    const base = { fetcher, getAccessToken: async () => null, visitorId: "visitor-1234", inAppBrowser: null };

    await expect(sendFunnelEvent("landing_cta_click", "hero", { ...base, enabled: false })).resolves.toBe(false);
    expect(calls).toHaveLength(0);

    await sendFunnelEvent("landing_cta_click", "hero", { ...base, enabled: true });
    await sendFunnelEvent("signup_complete", undefined, { ...base, enabled: true });
    const device = deviceClass();
    expect(JSON.parse(String(calls[0]?.body))).toEqual({ visitorId: "visitor-1234", event: "landing_cta_click", detail: `${device}:hero` });
    expect(JSON.parse(String(calls[1]?.body))).toEqual({ visitorId: "visitor-1234", event: "signup_complete", detail: device });
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
