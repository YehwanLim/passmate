import { describe, expect, it } from "vitest";
import { parseDraftResponse, splitBlanks } from "./experienceDraft";

describe("parseDraftResponse", () => {
  it("200 ok 를 camelCase 로 바꾼다", () => {
    const r = parseDraftResponse(200, {
      status: "ok",
      chosen: [{ experience_id: "e1", title: "T", reason: "R" }],
      sentences: [{ text: "가", kind: "experience", source_ids: ["e1"], unsourced: false }],
      draft_text: "가",
      char_count: 1,
      replaced_numbers: 0,
      remaining_today: 1,
    });
    expect(r).toEqual({
      kind: "ok",
      chosen: [{ experienceId: "e1", title: "T", reason: "R" }],
      sentences: [{ text: "가", kind: "experience", sourceIds: ["e1"], unsourced: false }],
      draftText: "가",
      charCount: 1,
      replacedNumbers: 0,
      remainingToday: 1,
    });
  });

  it("needs_more·오류 코드를 분류한다", () => {
    expect(parseDraftResponse(200, { status: "needs_more", need_more: "x", remaining_today: 2 })).toEqual({
      kind: "needs_more",
      needMore: "x",
      remainingToday: 2,
    });
    expect(parseDraftResponse(422, { error: "NO_EXPERIENCES" })).toEqual({ kind: "no_experiences" });
    expect(parseDraftResponse(429, { error: "RATE_LIMITED" })).toEqual({ kind: "rate_limited" });
    expect(parseDraftResponse(401, null)).toEqual({ kind: "auth_required" });
    expect(parseDraftResponse(502, { error: "DRAFT_FAILED" })).toEqual({ kind: "failed" });
    expect(parseDraftResponse(200, { status: "weird" })).toEqual({ kind: "failed" });
  });
});

describe("splitBlanks", () => {
  it("[…] 빈칸만 따로 떼어 낸다", () => {
    expect(splitBlanks("매출 [실제 수치] 증가")).toEqual([
      { text: "매출 ", blank: false },
      { text: "[실제 수치]", blank: true },
      { text: " 증가", blank: false },
    ]);
    expect(splitBlanks("빈칸 없음")).toEqual([{ text: "빈칸 없음", blank: false }]);
  });
});
