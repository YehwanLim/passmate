import { describe, expect, it } from "vitest";
import { parseKeywordResponse } from "./experienceKeywords";

describe("parseKeywordResponse", () => {
  it("서버 응답 필드(keywords·remaining_today)를 읽는다", () => {
    expect(parseKeywordResponse(200, { keywords: ["데이터", 3, " "], remaining_today: 19 })).toEqual({ kind: "ok", keywords: ["데이터"], remainingToday: 19 });
    expect(parseKeywordResponse(200, { keywords: [], remaining_today: 20 })).toEqual({ kind: "empty", remainingToday: 20 });
  });

  it("상태 코드별로 나눈다", () => {
    expect(parseKeywordResponse(401, null).kind).toBe("auth_required");
    expect(parseKeywordResponse(429, null).kind).toBe("rate_limited");
    expect(parseKeywordResponse(400, null).kind).toBe("invalid");
    expect(parseKeywordResponse(502, { error: "KEYWORDS_FAILED" }).kind).toBe("failed");
    expect(parseKeywordResponse(200, { nope: 1 }).kind).toBe("failed");
  });
});
