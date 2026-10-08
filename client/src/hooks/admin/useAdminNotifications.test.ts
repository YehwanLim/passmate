import { describe, expect, it } from "vitest";

import { NOTIFICATIONS_SEEN_KEY, notificationTotal, readSeenAt, writeSeenAt } from "./useAdminNotifications";

const NOW = new Date("2026-09-10T06:00:00.000Z");

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), map };
}

describe("알림함 마지막 확인 시각", () => {
  it("저장된 값이 없거나 망가졌거나 스토리지가 없으면 24시간 전", () => {
    const dayAgo = NOW.getTime() - 24 * 60 * 60 * 1000;
    expect(readSeenAt(memoryStorage(), NOW).getTime()).toBe(dayAgo);
    expect(readSeenAt(memoryStorage({ [NOTIFICATIONS_SEEN_KEY]: "nope" }), NOW).getTime()).toBe(dayAgo);
    expect(readSeenAt(null, NOW).getTime()).toBe(dayAgo);
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readSeenAt(throwing, NOW).getTime()).toBe(dayAgo);
    expect(() => writeSeenAt(throwing, NOW)).not.toThrow();
  });

  it("쓴 값을 그대로 읽는다", () => {
    const storage = memoryStorage();
    writeSeenAt(storage, NOW);
    expect(readSeenAt(storage, new Date("2026-09-11T00:00:00.000Z")).toISOString()).toBe(NOW.toISOString());
  });

  it("배지 수는 세 묶음의 합", () => {
    expect(notificationTotal(null)).toBe(0);
    expect(
      notificationTotal({
        since: NOW.toISOString(),
        mentoringRequested: { count: 2, items: [] },
        payments: { count: 1, items: [] },
        failedAnalyses: { count: 3, items: [] },
      }),
    ).toBe(6);
  });
});
