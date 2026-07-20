import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const serverPrompt = readFileSync(new URL("../../../server/prompts/reportPrompt.ts", import.meta.url), "utf8");
const serverAnalyze = readFileSync(new URL("../../../server/api/analyze.ts", import.meta.url), "utf8");
const apiAnalyze = readFileSync(new URL("../../../api/analyze.js", import.meta.url), "utf8");
const sharedPrompt = readFileSync(new URL("../../../shared/prompts/reportPrompt.js", import.meta.url), "utf8");

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
  });
});
