import { describe, expect, it } from "vitest";
import {
  closedPostings,
  dDayLabel,
  daysLeft,
  deadlineDateInput,
  formatDeadline,
  isOpen,
  openPostings,
} from "./jobPostingDates";

const NOW = new Date("2026-10-09T15:30:00+09:00");

describe("jobPostingDates", () => {
  it("formats the KST deadline with weekday", () => {
    expect(formatDeadline("2026-10-12T18:00:00+09:00")).toBe("10.12(월) 18:00");
    expect(formatDeadline("2026-10-05T23:59:00+09:00")).toBe("10.05(월) 23:59");
  });

  it("counts days on the KST calendar, not 24h blocks", () => {
    expect(daysLeft("2026-10-12T18:00:00+09:00", NOW)).toBe(3);
    expect(daysLeft("2026-10-10T00:30:00+09:00", new Date("2026-10-09T23:50:00+09:00"))).toBe(1);
    expect(dDayLabel("2026-10-09T23:59:00+09:00", NOW)).toBe("오늘 마감");
    expect(dDayLabel("2026-10-12T18:00:00+09:00", NOW)).toBe("D-3");
  });

  it("closes at the exact minute", () => {
    expect(isOpen("2026-10-09T15:31:00+09:00", NOW)).toBe(true);
    expect(isOpen("2026-10-09T15:30:00+09:00", NOW)).toBe(false);
  });

  it("gives the KST date for a date input", () => {
    expect(deadlineDateInput("2026-10-13T10:00:00+09:00")).toBe("2026-10-13");
    expect(deadlineDateInput("2026-10-13T00:30:00+09:00")).toBe("2026-10-13");
  });

  it("sorts open by nearest deadline and closed by most recent", () => {
    const list = [
      { closesAt: "2026-10-19T17:00:00+09:00" },
      { closesAt: "2026-10-02T17:00:00+09:00" },
      { closesAt: "2026-10-11T23:59:00+09:00" },
      { closesAt: "2026-09-30T17:00:00+09:00" },
    ];
    expect(openPostings(list, NOW).map(p => p.closesAt.slice(5, 10))).toEqual(["10-11", "10-19"]);
    expect(closedPostings(list, NOW).map(p => p.closesAt.slice(5, 10))).toEqual(["10-02", "09-30"]);
  });
});
