import { describe, expect, it } from "vitest";

import { buildDailyStatsRows } from "./DailyStatsTable";

describe("buildDailyStatsRows", () => {
  it("세 차트를 날짜로 합쳐 최신순으로 늘어놓고 빈 날은 0 으로 채운다", () => {
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
    );

    expect(rows).toEqual([
      { date: "09/08", visitors: 5, pageViews: 12, signups: 2, analyses: 4 },
      { date: "09/07", visitors: 0, pageViews: 0, signups: 0, analyses: 0 },
      { date: "09/06", visitors: 3, pageViews: 9, signups: 1, analyses: 0 },
    ]);
  });
});
