import { describe, expect, it } from "vitest";
import { formatDate } from "./formatDate";

// 로컬 시간대 정오로 만들어 날짜 부분이 시간대에 흔들리지 않게 한다.
const NOON = new Date(2026, 8, 12, 12, 34, 56);

describe("formatDate", () => {
  it("renders each preset with the expected parts", () => {
    expect(formatDate(NOON, "ymd")).toBe("2026. 09. 12.");
    expect(formatDate(NOON, "ymd-dot")).toBe("2026.09.12");
    expect(formatDate(NOON, "md-hm")).toMatch(/^09\. 12\. .*12:34$/);
    expect(formatDate(NOON, "md-hms")).toMatch(/^09\. 12\. .*12:34:56$/);
    expect(formatDate(NOON, "ymd-hm")).toMatch(/^2026\. 09\. 12\. .*12:34$/);
    expect(formatDate(NOON, "ymd-hms")).toMatch(/^2026\. 09\. 12\. .*12:34:56$/);
    expect(formatDate(NOON)).toBe(formatDate(NOON, "ymd-hm"));
  });

  it("accepts ISO strings and falls back for empty or unparsable values", () => {
    expect(formatDate(NOON.toISOString(), "ymd-dot")).toBe("2026.09.12");
    expect(formatDate(null)).toBe("–");
    expect(formatDate(undefined, "md-hm", "업데이트 없음")).toBe("업데이트 없음");
    expect(formatDate("not a date", "ymd")).toBe("–");
  });
});
