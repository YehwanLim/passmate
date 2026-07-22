import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { getAnalyzeErrorMessage } from "./Analyze";
import { UI_LABELS } from "@/constants/labels";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

describe("getAnalyzeErrorMessage", () => {
  it("uses server error text when message is omitted", () => {
    expect(
      getAnalyzeErrorMessage({
        error: "GEMINI_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.",
      })
    ).toBe("GEMINI_API_KEY가 설정되지 않았습니다. 서버 환경변수를 확인해주세요.");
  });

  it("falls back to the generic label when the server sends no useful details", () => {
    expect(getAnalyzeErrorMessage({})).toBe(UI_LABELS.ANALYSIS_FAILED);
  });

  it("shows a friendly message instead of raw Google high-demand errors", () => {
    expect(
      getAnalyzeErrorMessage({
        error: 'Google API Error 503: { "error": { "code": 503, "message": "This model is currently experiencing high demand.", "status": "UNAVAILABLE" } }',
      })
    ).toBe(UI_LABELS.MODEL_OVERLOADED_ERROR);
  });

  it("uses the shared auth profile button instead of a hard-coded login button in the header", () => {
    expect(analyzeSource).toContain("import AuthButton");
    expect(analyzeSource).toContain("<AuthButton />");
    expect(analyzeSource).toContain("내 지원서");
    expect(analyzeSource).not.toContain('navigate("/login?redirect=/analyze")');
  });
});
