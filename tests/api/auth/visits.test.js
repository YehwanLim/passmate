import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSiteVisitHandler, readVisitBody } from "../../../lib/site-visits.js";

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
      data: { visitorId: VISITOR_ID, path: "/", userId: null },
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

  it("readVisitBody 는 관리자 경로·쿼리·초과 길이·모르는 필드를 거른다", () => {
    expect(readVisitBody({ visitorId: VISITOR_ID, path: "/company-report" })).toEqual({ visitorId: VISITOR_ID, path: "/company-report" });
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
