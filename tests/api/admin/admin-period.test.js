import { describe, expect, it } from "vitest";

import { inPeriod, periodWhere, readPeriod, sumByBucket } from "../../../lib/admin-period.js";

// 2026-09-10(목) 15시 KST
const NOW = new Date("2026-09-10T06:00:00.000Z");

describe("admin period", () => {
  it("최근 7일·30일은 오늘 포함, KST 자정부터 시작하고 끝이 열려 있다", () => {
    const week = readPeriod({ period: "7d" }, NOW);
    expect(week.labels).toEqual(["09/04", "09/05", "09/06", "09/07", "09/08", "09/09", "09/10"]);
    expect(week.start.toISOString()).toBe("2026-09-03T15:00:00.000Z");
    expect(week.end).toBeNull();
    expect(periodWhere(week)).toEqual({ gte: week.start });

    expect(readPeriod({ period: "30d" }, NOW).labels).toHaveLength(30);
  });

  it("지난주는 지난 월요일 00:00 ~ 이번 월요일 00:00(KST)이다", () => {
    const lastWeek = readPeriod({ period: "lastWeek" }, NOW);
    expect(lastWeek.labels).toEqual(["08/31", "09/01", "09/02", "09/03", "09/04", "09/05", "09/06"]);
    expect(lastWeek.start.toISOString()).toBe("2026-08-30T15:00:00.000Z");
    expect(lastWeek.end.toISOString()).toBe("2026-09-06T15:00:00.000Z");
    expect(inPeriod(lastWeek, new Date("2026-09-06T14:59:59.000Z"))).toBe(true);
    expect(inPeriod(lastWeek, new Date("2026-09-06T15:00:00.000Z"))).toBe(false);
    expect(periodWhere(lastWeek)).toEqual({ gte: lastWeek.start, lt: lastWeek.end });
  });

  it("월요일 새벽에 열어도 지난주는 바로 앞 주다", () => {
    // 2026-09-07(월) 00:30 KST
    const lastWeek = readPeriod({ period: "lastWeek" }, new Date("2026-09-06T15:30:00.000Z"));
    expect(lastWeek.labels[0]).toBe("08/31");
    expect(lastWeek.labels.at(-1)).toBe("09/06");
  });

  it("월별은 이번 달 포함 6개월이고 연도를 넘긴다", () => {
    const months = readPeriod({ period: "months" }, new Date("2026-02-10T06:00:00.000Z"));
    expect(months.labels).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(months.start.toISOString()).toBe("2025-08-31T15:00:00.000Z");
    // KST 3월 1일 0시 직전은 2월 칸
    expect(months.bucketOf(new Date("2026-02-28T14:59:00.000Z"))).toBe("2026-02");
  });

  it("허용 밖 값은 최근 7일", () => {
    expect(readPeriod({ period: "90d" }, NOW).key).toBe("7d");
    expect(readPeriod({}, NOW).key).toBe("7d");
    expect(readPeriod(undefined, NOW).key).toBe("7d");
  });

  it("sumByBucket 은 기간 밖 행을 버린다", () => {
    const lastWeek = readPeriod({ period: "lastWeek" }, NOW);
    const rows = [
      { createdAt: new Date("2026-09-01T03:00:00.000Z"), n: 2 },
      { createdAt: new Date("2026-09-08T03:00:00.000Z"), n: 5 },
    ];
    const sums = sumByBucket(rows, lastWeek, (row) => row.n);
    expect(sums.reduce((total, point) => total + point.value, 0)).toBe(2);
  });
});
