import { describe, expect, it } from "vitest";

import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./analyzeErrors";
import { UI_LABELS } from "@/constants/labels";

describe("getAnalyzeErrorMessage", () => {
  it("does not expose raw server error text", () => {
    expect(
      getAnalyzeErrorMessage({
        error: "GEMINI_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.",
      })
    ).toBe(UI_LABELS.ANALYSIS_FAILED);
  });

  it("falls back to the generic label when the server sends no useful details", () => {
    expect(getAnalyzeErrorMessage({})).toBe(UI_LABELS.ANALYSIS_FAILED);
  });

  it("maps only documented opaque error codes", () => {
    expect(
      getAnalyzeErrorMessage({
        error: "ANALYSIS_DISABLED",
      })
    ).toContain("일시적으로 중단");
  });

  it("labels a rate-limit code as a request limit even when an intermediary changes the HTTP status", () => {
    expect(getAnalyzeErrorTitle({ error: "RATE_LIMITED" })).toBe("요청 제한");
  });

  it("explains the concurrency limit without exposing entitlement details", () => {
    const error = { error: "ANALYSIS_CONCURRENCY_LIMITED" };

    expect(getAnalyzeErrorTitle(error)).toBe("분석 진행 중");
    expect(getAnalyzeErrorMessage(error)).toContain("진행 중인 분석");
    expect(getAnalyzeErrorMessage(error)).not.toMatch(/이용권|premium|\d+회/i);
  });

  it("points exhausted users to the entitlements page instead of a beta dead end", () => {
    const message = getAnalyzeErrorMessage({ error: "ANALYSIS_CREDITS_EXHAUSTED" });
    expect(message).toContain("이용권");
    expect(message).not.toContain("베타");
  });
});
