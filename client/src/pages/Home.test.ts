import { describe, expect, it } from "vitest";
import { HOME_NAV_ITEMS } from "./Home";

describe("HOME_NAV_ITEMS", () => {
  it("shows only immediately usable top navigation items", () => {
    expect(HOME_NAV_ITEMS.map((item) => item.label)).toEqual([
      "서비스 소개",
      "자소서 분석",
      "내 지원서",
    ]);
  });

  it("does not expose coming soon navigation states", () => {
    expect(HOME_NAV_ITEMS.every((item) => item.type !== "coming_soon")).toBe(true);
  });
});
