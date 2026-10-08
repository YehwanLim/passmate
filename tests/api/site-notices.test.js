import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/prisma.js", () => ({ default: {} }));

const { createSiteNoticesHandler, isAllowedImageUrl, isAllowedLinkUrl, isNoticeLive, readNoticeBody } = await import(
  "../../lib/site-notices.js"
);
import { createResponse } from "../helpers/http.js";

const NOW = new Date("2026-10-09T03:00:00.000Z");
const notice = (overrides = {}) => ({
  id: "n1", kind: "BANNER", title: "점검 안내", body: "", linkUrl: null, linkLabel: null, imageUrl: null,
  active: true, startsAt: null, endsAt: null, createdAt: NOW, updatedAt: NOW, ...overrides,
});

describe("readNoticeBody — 공지 입력 검증", () => {
  it("만들 때는 종류와 제목이 필수, 빈 선택 칸은 null 로", () => {
    expect(readNoticeBody({ title: "x" })).toBeNull();
    expect(readNoticeBody({ kind: "POPUP", title: "  " })).toBeNull();
    expect(readNoticeBody({ kind: "POPUP", title: " 안내 ", linkUrl: "", imageUrl: null })).toEqual({
      kind: "POPUP", title: "안내", linkUrl: null, imageUrl: null,
    });
  });

  it("링크는 사이트 안 경로나 https, 이미지는 사이트 안 경로나 Supabase 저장소만", () => {
    expect(isAllowedLinkUrl("/guide")).toBe(true);
    expect(isAllowedLinkUrl("https://pf.kakao.com/x")).toBe(true);
    expect(isAllowedLinkUrl("//evil.com")).toBe(false);
    expect(isAllowedLinkUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedLinkUrl("http://insecure.com")).toBe(false);
    expect(isAllowedImageUrl("/images/event.png")).toBe(true);
    expect(isAllowedImageUrl("https://abcd.supabase.co/storage/v1/object/public/a.png")).toBe(true);
    expect(isAllowedImageUrl("https://imgur.com/a.png")).toBe(false);
    expect(readNoticeBody({ kind: "POPUP", title: "x", linkUrl: "javascript:alert(1)" })).toBeNull();
    expect(readNoticeBody({ kind: "POPUP", title: "x", imageUrl: "https://imgur.com/a.png" })).toBeNull();
  });

  it("길이·형식·기간 순서를 검사한다", () => {
    expect(readNoticeBody({ kind: "BANNER", title: "x".repeat(101) })).toBeNull();
    expect(readNoticeBody({ kind: "BANNER", title: "x", body: "y".repeat(1001) })).toBeNull();
    expect(readNoticeBody({ kind: "MODAL", title: "x" })).toBeNull();
    expect(readNoticeBody({ kind: "BANNER", title: "x", active: "yes" })).toBeNull();
    expect(readNoticeBody({ kind: "BANNER", title: "x", startsAt: "nope" })).toBeNull();
    expect(
      readNoticeBody({ kind: "BANNER", title: "x", startsAt: "2026-10-10T00:00:00Z", endsAt: "2026-10-09T00:00:00Z" }),
    ).toBeNull();
  });

  it("고칠 때는 온 필드만, 아무 것도 없으면 무효", () => {
    expect(readNoticeBody({ active: true }, { partial: true })).toEqual({ active: true });
    expect(readNoticeBody({}, { partial: true })).toBeNull();
    expect(readNoticeBody({ endsAt: null }, { partial: true })).toEqual({ endsAt: null });
  });
});

describe("GET /api/notices — 공개 공지", () => {
  it("켜져 있고 기간 안인 것만 보인다", () => {
    expect(isNoticeLive(notice(), NOW)).toBe(true);
    expect(isNoticeLive(notice({ active: false }), NOW)).toBe(false);
    expect(isNoticeLive(notice({ startsAt: new Date("2026-10-10T00:00:00Z") }), NOW)).toBe(false);
    expect(isNoticeLive(notice({ endsAt: NOW }), NOW)).toBe(false);
  });

  it("종류별로 가장 최근 공지 하나씩, 공개 필드만 준다(배너는 이미지 없음)", async () => {
    const findMany = vi.fn(async () => [
      notice({ id: "b-new", title: "새 배너", imageUrl: "/x.png" }),
      notice({ id: "p1", kind: "POPUP", title: "팝업", imageUrl: "/images/a.png", linkUrl: "/guide" }),
      notice({ id: "b-old", title: "옛 배너" }),
    ]);
    const handler = createSiteNoticesHandler({ db: { siteNotice: { findMany } }, now: () => NOW });
    const res = createResponse();

    await handler({ method: "GET", query: { notices: "1" }, headers: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      banner: { id: "b-new", kind: "BANNER", title: "새 배너", body: "", linkUrl: null, linkLabel: null, imageUrl: null },
      popup: { id: "p1", kind: "POPUP", title: "팝업", body: "", linkUrl: "/guide", linkLabel: null, imageUrl: "/images/a.png" },
    });
    expect(res.headers["Cache-Control"]).toContain("s-maxage=60");
    expect(findMany.mock.calls[0][0].where.active).toBe(true);
    expect(JSON.stringify(res.body)).not.toMatch(/active|createdAt/);
  });

  it("GET 말고는 405, DB 오류는 불투명한 오류로", async () => {
    const handler = createSiteNoticesHandler({ db: { siteNotice: { findMany: vi.fn(async () => { throw new Error("db down"); }) } } });
    const post = createResponse();
    await handler({ method: "POST", query: {}, headers: {} }, post);
    expect(post.statusCode).toBe(405);

    const failed = createResponse();
    await handler({ method: "GET", query: {}, headers: {} }, failed);
    expect(failed.statusCode).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain("db down");
  });
});
