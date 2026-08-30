import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./Analyze";
import { UI_LABELS } from "@/constants/labels";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const analyzeHeaderSource = analyzeSource.slice(
  analyzeSource.indexOf("{/* ════════ GNB ════════ */}"),
  analyzeSource.indexOf("{/* ════════ MAIN FORM ════════ */}"),
);

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
    expect(analyzeSource).toContain('trackAnalysisFailed("cover_letter", "analysis_concurrency_limited")');
  });

  it("points exhausted users to the entitlements page instead of a beta dead end", () => {
    const message = getAnalyzeErrorMessage({ error: "ANALYSIS_CREDITS_EXHAUSTED" });
    expect(message).toContain("이용권");
    expect(message).not.toContain("베타");
  });

  it("uses the shared auth profile button instead of a hard-coded login button in the header", () => {
    expect(analyzeSource).toContain("import AuthButton");
    expect(analyzeSource).toContain("<AuthButton />");
    expect(analyzeSource).toContain("내 지원서");
    expect(analyzeHeaderSource).not.toContain('navigate("/login');
  });

  it("treats a 202 receipt as accepted work and does not inspect a report body", () => {
    expect(analyzeSource).toContain("response.status !== 202 && response.status !== 200");
    expect(analyzeSource).toContain("analysisPendingPath(receipt.analysisRequestId)");
    expect(analyzeSource).not.toContain("data.report.questionTabs");
    expect(analyzeSource).not.toContain("new AbortController()");
  });
});
