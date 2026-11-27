import { describe, expect, it } from "vitest";
import { buildReportNavSections } from "@/lib/report/reportNavigation";
import {
  ANALYZE_INTENT_SECTION_ID,
  parseAnalyzeIntent,
  readAnalyzeIntent,
  withAnalyzeIntent,
} from "./analyzeIntent";

describe("analyzeIntent", () => {
  it("아는 값(interview)만 통과시키고 나머지는 평소 화면(null)으로 둔다", () => {
    expect(parseAnalyzeIntent("interview")).toBe("interview");
    expect(parseAnalyzeIntent("INTERVIEW")).toBeNull();
    expect(parseAnalyzeIntent("")).toBeNull();
    expect(parseAnalyzeIntent(undefined)).toBeNull();
    expect(parseAnalyzeIntent(1)).toBeNull();
  });

  it("검색어에서 intent 를 읽는다", () => {
    expect(
      readAnalyzeIntent("?company=%EC%82%BC%EC%84%B1&intent=interview")
    ).toBe("interview");
    expect(readAnalyzeIntent("?company=a")).toBeNull();
    expect(readAnalyzeIntent("")).toBeNull();
  });

  it("경로에 intent 를 이어 붙이고, 없으면 경로를 그대로 둔다", () => {
    expect(withAnalyzeIntent("/analyze", "interview")).toBe(
      "/analyze?intent=interview"
    );
    expect(withAnalyzeIntent("/analyze?company=a", "interview")).toBe(
      "/analyze?company=a&intent=interview"
    );
    expect(withAnalyzeIntent("/analyze", null)).toBe("/analyze");
    expect(withAnalyzeIntent("/analyze?company=a", undefined)).toBe(
      "/analyze?company=a"
    );
  });

  it("면접 intent 가 여는 섹션은 자소서 리포트 목차의 예상 질문이다", () => {
    expect(ANALYZE_INTENT_SECTION_ID.interview).toBe("section-interview-drill");
    for (const hasPostingFit of [false, true]) {
      const ids = buildReportNavSections({ hasPostingFit }).map(
        section => section.id
      );
      expect(ids).toContain(ANALYZE_INTENT_SECTION_ID.interview);
    }
  });
});
