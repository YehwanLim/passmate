import { describe, expect, it } from "vitest";
import { parseAnalysisSections } from "./analysisSections";

describe("parseAnalysisSections", () => {
  it("splits multi-question texts stored by api/analyze.js back into sections", () => {
    const questionText = "[문항 1] 지원 동기를 작성하세요.\n\n[문항 2] 협업 경험을 작성하세요.";
    const inputText = "[문항 1]\n저는 이 회사에 지원한 이유가...\n\n[문항 2]\n팀 프로젝트에서...";

    expect(parseAnalysisSections(questionText, inputText)).toEqual([
      { question: "지원 동기를 작성하세요.", answer: "저는 이 회사에 지원한 이유가..." },
      { question: "협업 경험을 작성하세요.", answer: "팀 프로젝트에서..." },
    ]);
  });

  it("keeps blank lines inside an answer body", () => {
    const inputText = "[문항 1]\n첫 문단입니다.\n\n둘째 문단입니다.\n\n[문항 2]\n다음 답변";
    const sections = parseAnalysisSections("[문항 1] 질문\n\n[문항 2] 질문2", inputText);

    expect(sections[0].answer).toBe("첫 문단입니다.\n\n둘째 문단입니다.");
    expect(sections[1].answer).toBe("다음 답변");
  });

  it("returns question-only sections when input_text is not loaded yet", () => {
    const sections = parseAnalysisSections("[문항 1] 질문1\n\n[문항 2] 질문2");
    expect(sections).toEqual([
      { question: "질문1", answer: "" },
      { question: "질문2", answer: "" },
    ]);
  });

  it("falls back to a single section when no markers exist", () => {
    expect(parseAnalysisSections("자유 질문", "자유 답변")).toEqual([
      { question: "자유 질문", answer: "자유 답변" },
    ]);
  });

  it("returns an empty list for empty inputs", () => {
    expect(parseAnalysisSections(null, null)).toEqual([]);
    expect(parseAnalysisSections("", "")).toEqual([]);
  });
});
