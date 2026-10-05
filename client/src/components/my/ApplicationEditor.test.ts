import { describe, expect, it } from "vitest";
import { draftNotice, parseCharLimit } from "./ApplicationEditor";

describe("parseCharLimit", () => {
  it("1..10000 정수만 받고 나머지는 null", () => {
    expect(parseCharLimit("700")).toBe(700);
    expect(parseCharLimit("1")).toBe(1);
    expect(parseCharLimit("10000")).toBe(10000);
    for (const bad of ["", " ", "0", "-3", "1.5", "10001", "abc"]) expect(parseCharLimit(bad)).toBeNull();
  });
});

describe("draftNotice", () => {
  it("결과 종류마다 안내 문구, ok 는 null", () => {
    expect(draftNotice({ kind: "rate_limited" })).toContain("오전 9시");
    expect(draftNotice({ kind: "needs_more", needMore: "협업 경험", remainingToday: 2 })).toContain("협업 경험");
    expect(draftNotice({ kind: "no_experiences" })).toContain("경험이 하나 이상");
    expect(draftNotice({ kind: "failed" })).toContain("차감되지 않았어요");
    expect(draftNotice({ kind: "auth_required" })).toContain("로그인");
    expect(
      draftNotice({ kind: "ok", chosen: [], sentences: [], draftText: "", charCount: 0, replacedNumbers: 0, remainingToday: 1 })
    ).toBeNull();
  });
});
