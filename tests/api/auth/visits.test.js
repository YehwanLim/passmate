import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CLIENT_EVENT_NAMES,
  createSiteVisitHandler,
  normalizeReferrer,
  readClientEventBody,
  readVisitBody,
} from "../../../lib/site-visits.js";

function response() {
  return {
    body: undefined,
    statusCode: 200,
    headers: {},
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    status(statusCode) { this.statusCode = statusCode; return this; },
  };
}

function createDb() {
  return {
    user: { findUnique: vi.fn() },
    siteVisit: { create: vi.fn(async ({ data }) => ({ id: "visit-1", ...data })) },
    clientEvent: { create: vi.fn(async ({ data }) => ({ id: "event-1", ...data })) },
  };
}

const VISITOR_ID = "8c4d2a70-3b1e-4d5f-9a6b-2c1d0e9f8a7b";

describe("POST /api/visits — 방문 핑", () => {
  let db;
  beforeEach(() => {
    db = createDb();
  });

  it("로그인 없이도 방문을 기록한다", async () => {
    const handler = createSiteVisitHandler({ db, authenticate: async () => null });
    const res = response();

    await handler({ method: "POST", headers: {}, body: { visitorId: VISITOR_ID, path: "/" } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ recorded: true });
    expect(db.siteVisit.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { visitorId: VISITOR_ID, path: "/", userId: null, referrer: null, utmSource: null, inAppBrowser: null },
    }));
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("로그인 상태면 앱 계정 ID 를 붙인다", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1" });
    const handler = createSiteVisitHandler({ db, authenticate: async () => ({ id: "user-1" }) });
    const res = response();

    await handler({ method: "POST", headers: { authorization: "Bearer t" }, body: { visitorId: VISITOR_ID, path: "/analyze" } }, res);

    expect(db.siteVisit.create.mock.calls[0][0].data.userId).toBe("user-1");
  });

  it("토큰이 만료됐거나 앱 계정이 없어도 익명으로 기록한다", async () => {
    db.user.findUnique.mockResolvedValue(null);
    const expired = createSiteVisitHandler({ db, authenticate: async () => { throw new Error("expired"); } });
    const noAccount = createSiteVisitHandler({ db, authenticate: async () => ({ id: "ghost" }) });

    const first = response();
    await expired({ method: "POST", headers: {}, body: { visitorId: VISITOR_ID, path: "/" } }, first);
    const second = response();
    await noAccount({ method: "POST", headers: {}, body: { visitorId: VISITOR_ID, path: "/" } }, second);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(db.siteVisit.create).toHaveBeenCalledTimes(2);
    expect(db.siteVisit.create.mock.calls.every(([call]) => call.data.userId === null)).toBe(true);
  });

  it("잘못된 본문은 400, GET 은 405 로 거절하고 아무것도 쓰지 않는다", async () => {
    const handler = createSiteVisitHandler({ db, authenticate: async () => null });

    const bad = response();
    await handler({ method: "POST", headers: {}, body: { visitorId: "x", path: "/" } }, bad);
    const get = response();
    await handler({ method: "GET", headers: {}, body: undefined }, get);

    expect(bad.statusCode).toBe(400);
    expect(bad.body.error).toBe("INVALID_REQUEST");
    expect(get.statusCode).toBe(405);
    expect(db.siteVisit.create).not.toHaveBeenCalled();
  });

  it("유입원(referrer·utmSource)은 쿼리를 떼고 저장하고, 이상한 값은 방문은 남기되 유입원만 버린다", async () => {
    const handler = createSiteVisitHandler({ db, authenticate: async () => null });

    const res = response();
    await handler({
      method: "POST", headers: {},
      body: { visitorId: VISITOR_ID, path: "/", referrer: "https://blog.naver.com/hansi/223?from=search#top", utmSource: "threads" },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(db.siteVisit.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      referrer: "https://blog.naver.com/hansi/223", utmSource: "threads",
    }));

    const odd = response();
    await handler({
      method: "POST", headers: {},
      body: { visitorId: VISITOR_ID, path: "/", referrer: "javascript:alert(1)", utmSource: "bad source!" },
    }, odd);
    expect(odd.statusCode).toBe(200);
    expect(db.siteVisit.create.mock.calls[1][0].data).toEqual(expect.objectContaining({ referrer: null, utmSource: null }));

    expect(normalizeReferrer(`https://example.com/${"a".repeat(300)}`)).toHaveLength(200);
    expect(normalizeReferrer("not a url")).toBeNull();
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/", referrer: 42 })).toBeNull();
  });

  it("첫 핑의 인앱 브라우저 종류를 저장하고, 형식이 이상하면 방문은 남기되 그 값만 버린다", async () => {
    const handler = createSiteVisitHandler({ db, authenticate: async () => null });

    const res = response();
    await handler({ method: "POST", headers: {}, body: { visitorId: VISITOR_ID, path: "/", inAppBrowser: "kakaotalk" } }, res);
    expect(res.statusCode).toBe(200);
    expect(db.siteVisit.create.mock.calls[0][0].data.inAppBrowser).toBe("kakaotalk");

    const odd = response();
    await handler({ method: "POST", headers: {}, body: { visitorId: VISITOR_ID, path: "/", inAppBrowser: "Kakao Talk!" } }, odd);
    expect(odd.statusCode).toBe(200);
    expect(db.siteVisit.create.mock.calls[1][0].data.inAppBrowser).toBeNull();

    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/", inAppBrowser: 3 })).toBeNull();
  });

  it("로그인 화면 이벤트(event 필드)는 방문이 아니라 client_events 에 쌓인다", async () => {
    db.user.findUnique.mockResolvedValue({ id: "user-1" });
    const handler = createSiteVisitHandler({ db, authenticate: async () => ({ id: "user-1" }) });

    const res = response();
    await handler({
      method: "POST", headers: { authorization: "Bearer t" },
      body: { visitorId: VISITOR_ID, event: "google_signin_failed", detail: "Invalid nonce", inAppBrowser: "instagram" },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ recorded: true });
    expect(db.siteVisit.create).not.toHaveBeenCalled();
    expect(db.clientEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { visitorId: VISITOR_ID, userId: "user-1", name: "google_signin_failed", detail: "Invalid nonce", inAppBrowser: "instagram" },
    }));
  });

  it("모르는 이벤트 이름·긴 detail·이상한 필드는 거르되, detail 은 잘라서 받는다", async () => {
    const handler = createSiteVisitHandler({ db, authenticate: async () => null });

    const unknown = response();
    await handler({ method: "POST", headers: {}, body: { visitorId: VISITOR_ID, event: "resume_text", detail: "본문" } }, unknown);
    expect(unknown.statusCode).toBe(400);
    expect(db.clientEvent.create).not.toHaveBeenCalled();

    const long = readClientEventBody({ visitorId: VISITOR_ID, event: "kakao_start_failed", detail: "x".repeat(500) });
    expect(long?.detail).toHaveLength(120);
    expect(readClientEventBody({ visitorId: VISITOR_ID, event: "login_prompt_in_app", inAppBrowser: "threads" })).toEqual({
      visitorId: VISITOR_ID, name: "login_prompt_in_app", detail: null, inAppBrowser: "threads",
    });
    expect(readClientEventBody({ visitorId: VISITOR_ID, event: "login_prompt_in_app", path: "/" })).toBeNull();
    expect(readClientEventBody({ visitorId: "bad!", event: "login_prompt_in_app" })).toBeNull();
    expect(readClientEventBody({ visitorId: VISITOR_ID, event: "login_prompt_in_app", detail: 7 })).toBeNull();
    // 이름 목록은 클라이언트(siteVisits.ts)와 대시보드가 같이 쓰는 계약이다.
    expect(CLIENT_EVENT_NAMES).toEqual([
      "login_prompt_in_app",
      "google_button_unavailable",
      "google_signin_failed",
      "kakao_start_failed",
    ]);
  });

  it("readVisitBody 는 관리자 경로·쿼리·초과 길이·모르는 필드를 거른다", () => {
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/company-report" })).toEqual({ visitorId: VISITOR_ID, path: "/company-report", referrer: null, utmSource: null, inAppBrowser: null });
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/admin" })).toBeNull();
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/admin/users" })).toBeNull();
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/?q=1" })).toBeNull();
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "relative" })).toBeNull();
    expect(readVisitBody({ visitorId: VISITOR_ID, path: `/${"a".repeat(200)}` })).toBeNull();
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/", extra: 1 })).toBeNull();
    expect(readVisitBody({ visitorId: "not valid!", path: "/" })).toBeNull();
    expect(readVisitBody(null)).toBeNull();
  });
});
