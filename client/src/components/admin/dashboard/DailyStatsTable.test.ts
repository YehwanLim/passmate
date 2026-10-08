import { describe, expect, it } from "vitest";

import { buildDailyStatsRows, sumDailyStatsRows } from "./DailyStatsTable";

const EMPTY_PRODUCTS = { SINGLE: 0, COMPANY_SINGLE: 0, STANDARD: 0, PREMIUM: 0, TRIPLE: 0, UNKNOWN: 0 };

describe("buildDailyStatsRows", () => {
  it("다섯 시계열을 칸으로 합쳐 최신순으로 늘어놓고 빈 칸은 0 으로 채운다", () => {
    const rows = buildDailyStatsRows(
      [
        { date: "09/06", visitors: 3, pageViews: 9 },
        { date: "09/07", visitors: 0, pageViews: 0 },
        { date: "09/08", visitors: 5, pageViews: 12 },
      ],
      [
        { date: "09/06", count: 1 },
        { date: "09/07", count: 0 },
        { date: "09/08", count: 2 },
      ],
      [{ date: "09/08", count: 4 }],
      [{ date: "09/08", count: 2, byProduct: { ...EMPTY_PRODUCTS, SINGLE: 1, UNKNOWN: 1 } }],
      [{ date: "09/06", cost: 0.12 }],
    );

    expect(rows.map((row) => row.date)).toEqual(["09/08", "09/07", "09/06"]);
    expect(rows[0]).toEqual(expect.objectContaining({ visitors: 5, pageViews: 12, signups: 2, analyses: 4, payments: 2, aiCost: 0 }));
    // 상품을 모르는 결제는 추정 매출에서 뺀다
    expect(rows[0].revenue).toBeGreaterThan(0);
    expect(rows[1]).toEqual({ date: "09/07", visitors: 0, pageViews: 0, signups: 0, analyses: 0, payments: 0, revenue: 0, aiCost: 0 });
    expect(rows[2].aiCost).toBe(0.12);
  });

  it("합계 행은 칸을 단순히 더한다", () => {
    const rows = buildDailyStatsRows(
      [
        { date: "2026-08", visitors: 10, pageViews: 30 },
        { date: "2026-09", visitors: 4, pageViews: 8 },
      ],
      [{ date: "2026-09", count: 2 }],
      [{ date: "2026-08", count: 1 }],
    );
    expect(sumDailyStatsRows(rows)).toEqual({ visitors: 14, pageViews: 38, signups: 2, analyses: 1, payments: 0, revenue: 0, aiCost: 0 });
  });
});
