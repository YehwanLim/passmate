import { describe, expect, it } from "vitest";

import { groupSlotsByDay, slotDayLabel, slotTimeLabel } from "./mentoring";

describe("mentoring slot labels", () => {
  it("KST 로 날짜·시간을 표기하고 같은 날 슬롯을 묶는다", () => {
    // 2026-09-27T11:00Z = 27일 20:00 KST, 2026-09-27T15:30Z = 28일 00:30 KST
    const slots = [
      { id: "a", startsAt: "2026-09-27T11:00:00.000Z", durationMin: 40 },
      { id: "b", startsAt: "2026-09-27T12:00:00.000Z", durationMin: 40 },
      { id: "c", startsAt: "2026-09-27T15:30:00.000Z", durationMin: 30 },
    ];
    expect(slotDayLabel(slots[0].startsAt)).toBe("9월 27일 (일)");
    expect(slotTimeLabel(slots[0].startsAt)).toBe("오후 8:00");
    const groups = groupSlotsByDay(slots);
    expect(groups.map(group => [group.day, group.slots.map(slot => slot.id)])).toEqual([
      ["9월 27일 (일)", ["a", "b"]],
      ["9월 28일 (월)", ["c"]],
    ]);
  });
});
