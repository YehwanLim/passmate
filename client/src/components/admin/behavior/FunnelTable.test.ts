import { describe, expect, it } from "vitest";

import { biggestDrop, buildFunnelRows, keptLabel } from "./FunnelTable";

const step = (key: string, count: number) => ({ key, label: key, count, mobile: null, desktop: null });

describe("buildFunnelRows", () => {
  it("앞 단계 대비 남은 비율과 떠난 인원을 붙이고, 앞 단계가 0 이면 비율을 비운다", () => {
    const rows = buildFunnelRows([step("visit", 200), step("form", 50), step("submit", 0), step("signup", 3)]);
    expect(rows.map((row) => [row.keptRate, row.dropped])).toEqual([
      [null, 0],
      [25, 150],
      [0, 50],
      [null, 0],
    ]);
  });

  it("가장 많이 빠지는 단계는 남은 비율이 가장 낮은 곳", () => {
    const rows = buildFunnelRows([step("visit", 200), step("form", 50), step("submit", 40), step("signup", 2)]);
    expect(biggestDrop(rows)?.key).toBe("signup");
    expect(biggestDrop(buildFunnelRows([step("visit", 0)]))).toBeNull();
  });

  it("뒤 단계가 더 크면 비율 대신 늘어남", () => {
    expect(keptLabel(400)).toBe("늘어남");
    expect(keptLabel(33.3)).toBe("33.3%");
    expect(keptLabel(null)).toBe("–");
  });
});
