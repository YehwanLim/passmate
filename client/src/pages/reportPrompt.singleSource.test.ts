import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MASTER_SYSTEM_PROMPT } from "../../../shared/prompts/reportPrompt.js";

const serverPrompt = readFileSync(new URL("../../../server/prompts/reportPrompt.ts", import.meta.url), "utf8");
const serverAnalyze = readFileSync(new URL("../../../server/api/analyze.ts", import.meta.url), "utf8");
const apiAnalyze = readFileSync(new URL("../../../api/analyze.js", import.meta.url), "utf8");
const sharedPrompt = readFileSync(new URL("../../../shared/prompts/reportPrompt.js", import.meta.url), "utf8");
const outputMarker = "# [출력: JSON만, 마크다운 코드 블록 없이]";
const constraintsMarker = "# [제약 조건]";

function extractOutputJsonExample(prompt: string) {
  const outputStart = prompt.indexOf(outputMarker);
  const jsonStart = prompt.indexOf("{", outputStart + outputMarker.length);
  const jsonEnd = prompt.indexOf(constraintsMarker, jsonStart);

  if (outputStart === -1 || jsonStart === -1 || jsonEnd === -1) {
    throw new Error("MASTER_SYSTEM_PROMPT output JSON example is missing");
  }

  return prompt.slice(jsonStart, jsonEnd).trim();
}

describe("report prompt single source", () => {
  it("keeps the prompt body in the shared prompt module only", () => {
    expect(sharedPrompt).toContain("export const MASTER_SYSTEM_PROMPT");
    expect(sharedPrompt).toContain("당신은 국내 대기업");
    expect(serverPrompt).toContain("../../shared/prompts/reportPrompt.js");
    expect(serverPrompt).not.toContain("당신은 국내 대기업");
    expect(apiAnalyze).not.toContain("const MASTER_SYSTEM_PROMPT = `");
  });

  it("uses the same prompt module from local dev and serverless analysis paths", () => {
    expect(serverAnalyze).toContain("../prompts/reportPrompt");
    expect(apiAnalyze).toContain("../shared/prompts/reportPrompt.js");
  });

  it("keeps editorial interpretation rules in the canonical prompt", () => {
    expect(sharedPrompt).toContain("반복해서 보여주는 하나의 관통 패턴");
    expect(sharedPrompt).toContain("도메인 + 행동 + 특징");
    expect(sharedPrompt).toContain("산업, 프로젝트, 직무, 기술");
    expect(sharedPrompt).toContain("인정 → 왜 좋은지 → 무엇이 조금 부족한지 → 어떻게 보완하면 더 좋아지는지");
    expect(sharedPrompt).toContain("서로 다른 관점");
    expect(sharedPrompt).toContain("feedbackCards의 original 필드");
    expect(sharedPrompt).toContain("공백 포함 28자 이내");
    expect(sharedPrompt).toContain("공백 포함 42자 이내");
    expect(sharedPrompt).toContain("명함형 제목 금지");
    expect(sharedPrompt).toContain("시장 신호를 읽는 마케터");
    expect(sharedPrompt).toContain("firstImpression.persona에는 굵게 표시나 HTML span을 절대 사용하지 않는다");
    expect(sharedPrompt).toContain("두 줄로 나뉘어도 어색하지 않은 리듬");
    expect(sharedPrompt).toContain("핵심 문장 강조 규칙");
    expect(sharedPrompt).toContain("단어 하나하나를 강조하지 말고");
    expect(sharedPrompt).toContain("약 10~20%만 사용");
    expect(sharedPrompt).toContain("핵심 문장 전체를 강조");
    expect(sharedPrompt).toContain("상단 리포트 카드에는 강조 표시를 절대 사용하지 않는다");
    expect(sharedPrompt).toContain("핵심 결론이나 요약을 담은 문장만");
    expect(sharedPrompt).toContain("HTML span과 색상 강조는 사용하지 않는다");
    expect(sharedPrompt).not.toContain("한 문단당 최대 3~4개");
    expect(sharedPrompt).not.toContain("숫자나 성과 수치만 따로 **굵게 표시**하지 않는다");
    expect(sharedPrompt).not.toContain("성과와 숫자는 문장 안에서 필요할 때만 **굵게 표시**한다");
    expect(sharedPrompt).not.toContain("text-emerald-400 font-semibold");
    expect(sharedPrompt).toContain("정확히 세 문단");
    expect(sharedPrompt).toContain("빈 줄(\\\\n\\\\n)");
    expect(sharedPrompt).toContain("각 문단은 1~2문장");
  });

  it("keeps the pmComment paragraph separator as a JSON escape at runtime", () => {
    expect(MASTER_SYSTEM_PROMPT).toContain("빈 줄(\\n\\n)");
  });

  it("keeps the runtime JSON example valid and restores pmComment paragraphs", () => {
    const outputExample = extractOutputJsonExample(MASTER_SYSTEM_PROMPT);

    expect(MASTER_SYSTEM_PROMPT).toContain("빈 줄(\\n\\n)");
    expect(outputExample).toContain('"pmComment"');
    expect(outputExample).toContain("\\n\\n");

    expect(outputExample).toMatch(/"pmComment": "[^"\r\n]*\\n\\n[^"\r\n]*"/);

    const parsed = JSON.parse(outputExample) as { pmComment: string };
    expect(parsed.pmComment).toContain("\n\n");
  });
});
