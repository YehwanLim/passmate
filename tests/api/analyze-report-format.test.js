import { describe, expect, it } from "vitest";

import { attachRequestAnswers } from "../../api/analyze.js";

describe("stored analysis report format", () => {
  it("adds the validated prompt and answer to each generated question tab", () => {
    const report = attachRequestAnswers(
      { questionTabs: [{ title: "문항 1" }, { title: "문항 2", prompt: "already-set" }] },
      [
        { question: "첫 번째 질문", answer: "첫 번째 답변" },
        { question: "두 번째 질문", answer: "두 번째 답변" },
      ],
    );

    expect(report.questionTabs).toEqual([
      { title: "문항 1", prompt: "첫 번째 질문", fullAnswer: "첫 번째 답변" },
      { title: "문항 2", prompt: "두 번째 질문", fullAnswer: "두 번째 답변" },
    ]);
  });
});
