import { describe, expect, it } from "vitest";

import { EMPTY_NOTICE_FORM, formToBody, noticeStatus, shownNoticeIds, validateNoticeForm, type AdminNotice } from "./noticeForm";

const NOW = new Date("2026-10-09T03:00:00.000Z");
const notice = (overrides: Partial<AdminNotice>): AdminNotice => ({
  id: "n", kind: "BANNER", title: "t", body: "", linkUrl: null, linkLabel: null, imageUrl: null,
  active: true, startsAt: null, endsAt: null, createdAt: "2026-10-01T00:00:00.000Z", ...overrides,
});

describe("공지 폼", () => {
  it("빈 칸은 null 로 보내고 배너는 이미지를 버린다", () => {
    expect(formToBody({ ...EMPTY_NOTICE_FORM, title: " 안내 ", imageUrl: "/a.png" })).toEqual({
      kind: "BANNER", title: "안내", body: "", linkUrl: null, linkLabel: null, imageUrl: null, active: false, startsAt: null, endsAt: null,
    });
  });

  it("화면에서 먼저 막는 입력", () => {
    expect(validateNoticeForm(EMPTY_NOTICE_FORM)).toMatch(/제목/);
    expect(validateNoticeForm({ ...EMPTY_NOTICE_FORM, title: "x", linkUrl: "www.naver.com" })).toMatch(/링크/);
    expect(validateNoticeForm({ ...EMPTY_NOTICE_FORM, kind: "POPUP", title: "x", imageUrl: "https://imgur.com/a.png" })).toMatch(/이미지/);
    expect(validateNoticeForm({ ...EMPTY_NOTICE_FORM, title: "x", startsAt: "2026-10-10T10:00", endsAt: "2026-10-10T09:00" })).toMatch(/끝 시각/);
    expect(validateNoticeForm({ ...EMPTY_NOTICE_FORM, title: "x", linkUrl: "/entitlements" })).toBeNull();
  });

  it("상태: 꺼짐·예약됨·보이는 중·기간 끝남", () => {
    expect(noticeStatus(notice({ active: false }), NOW)).toBe("off");
    expect(noticeStatus(notice({ startsAt: "2026-10-10T00:00:00.000Z" }), NOW)).toBe("scheduled");
    expect(noticeStatus(notice({ endsAt: "2026-10-08T00:00:00.000Z" }), NOW)).toBe("ended");
    expect(noticeStatus(notice({}), NOW)).toBe("live");
  });

  it("같은 종류가 여럿 켜져 있으면 가장 최근 것만 보인다", () => {
    const shown = shownNoticeIds(
      [
        notice({ id: "old", createdAt: "2026-10-01T00:00:00.000Z" }),
        notice({ id: "new", createdAt: "2026-10-05T00:00:00.000Z" }),
        notice({ id: "pop", kind: "POPUP" }),
      ],
      NOW,
    );
    expect([...shown].sort()).toEqual(["new", "pop"]);
  });
});
