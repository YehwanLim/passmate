import { describe, expect, it } from "vitest";

import { getAnalyzeErrorMessage } from "./Analyze";
import { UI_LABELS } from "@/constants/labels";

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
});
