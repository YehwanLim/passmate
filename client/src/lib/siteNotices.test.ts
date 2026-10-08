import { describe, expect, it } from "vitest";

import { closeNoticeForSession, hideNoticeForToday, isExternalLink, isNoticeHidden, nextKstMidnight } from "./siteNotices";

function memory() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value) };
}

// 2026-10-09 23:30 KST
const NOW = new Date("2026-10-09T14:30:00.000Z");

describe("공지 숨김", () => {
  it("'오늘 하루 보지 않기'는 다음 KST 자정까지", () => {
    expect(nextKstMidnight(NOW).toISOString()).toBe("2026-10-09T15:00:00.000Z");
    const local = memory();
    hideNoticeForToday("p1", local, NOW);
    expect(isNoticeHidden("p1", { local, session: memory(), now: NOW })).toBe(true);
    expect(isNoticeHidden("p1", { local, session: memory(), now: new Date("2026-10-09T15:00:01.000Z") })).toBe(false);
    expect(isNoticeHidden("other", { local, session: memory(), now: NOW })).toBe(false);
  });

  it("'닫기'는 이번 방문(세션)에서만", () => {
    const session = memory();
    closeNoticeForSession("b1", session);
    expect(isNoticeHidden("b1", { local: memory(), session, now: NOW })).toBe(true);
    expect(isNoticeHidden("b1", { local: memory(), session: memory(), now: NOW })).toBe(false);
  });

  it("스토리지를 못 쓰면 그냥 보인다", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(isNoticeHidden("p1", { local: broken, session: broken, now: NOW })).toBe(false);
    expect(() => hideNoticeForToday("p1", broken, NOW)).not.toThrow();
  });

  it("바깥 주소만 새 창", () => {
    expect(isExternalLink("https://pf.kakao.com/x")).toBe(true);
    expect(isExternalLink("/guide")).toBe(false);
  });
});
