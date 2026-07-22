import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSavedQuestions } from "./Analyze";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");

describe("previous resume loading", () => {
  it("starts with an empty form and provides an explicit way to load a saved resume", () => {
    expect(analyzeSource).not.toContain("const draft = loadDraft()");
    expect(analyzeSource).toContain("이전 지원서 불러오기");
    expect(analyzeSource).toContain("/api/projects?userId=");
    expect(analyzeSource).toContain("/api/analysis/${encodeURIComponent(analysisId)}");
  });

  it("restores each saved question and answer into a separate form item", () => {
    expect(
      parseSavedQuestions(
        "[문항 1] 지원 동기를 작성해 주세요.\n\n[문항 2] 입사 후 포부를 작성해 주세요.",
        "[문항 1]\n첫 번째 답변\n\n[문항 2]\n두 번째 답변"
      )
    ).toEqual([
      { question: "지원 동기를 작성해 주세요.", answer: "첫 번째 답변" },
      { question: "입사 후 포부를 작성해 주세요.", answer: "두 번째 답변" },
    ]);
  });
});
