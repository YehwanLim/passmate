import { describe, expect, it } from "vitest";
import { parseSavedQuestions } from "./Analyze";

describe("previous resume loading", () => {
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
