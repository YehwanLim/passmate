import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANY_REPORT_SYSTEM_PROMPT } from "../../../shared/prompts/companyReportPrompt.js";

const apiAnalyze = readFileSync(new URL("../../../api/analyze.js", import.meta.url), "utf8");
const companyAnalysis = readFileSync(new URL("../../../lib/company-analysis.js", import.meta.url), "utf8");
const outputMarker = "# [출력: JSON만, 마크다운 코드 블록 없이]";
const constraintsMarker = "# [제약 조건]";

function extractOutputJsonExample(prompt: string) {
  const outputStart = prompt.indexOf(outputMarker);
  const jsonStart = prompt.indexOf("{", outputStart + outputMarker.length);
  const jsonEnd = prompt.indexOf(constraintsMarker, jsonStart);
  if (outputStart === -1 || jsonStart === -1 || jsonEnd === -1) {
    throw new Error("COMPANY_REPORT_SYSTEM_PROMPT output JSON example is missing");
  }
  return prompt.slice(jsonStart, jsonEnd).trim();
}

describe("company report prompt single source", () => {
  it("keeps the prompt body out of the handler and the analysis module", () => {
    expect(apiAnalyze).not.toContain("const COMPANY_REPORT_SYSTEM_PROMPT = `");
    expect(companyAnalysis).toContain("../shared/prompts/companyReportPrompt.js");
    expect(companyAnalysis).not.toContain("const COMPANY_REPORT_SYSTEM_PROMPT = `");
  });

  it("keeps the runtime JSON example valid with the eight report sections", () => {
    const parsed = JSON.parse(extractOutputJsonExample(COMPANY_REPORT_SYSTEM_PROMPT));
    expect(Object.keys(parsed)).toEqual([
      "brief",
      "businessMap",
      "focusBusinesses",
      "financialSnapshot",
      "currentIssues",
      "roleInContext",
      "opportunitiesAndRisks",
      "businessCandidates",
      "interviewPrep",
    ]);
    expect(parsed.financialSnapshot.keyFigures).toHaveLength(1);
    expect(parsed.roleInContext.recentNewsForRole).toHaveLength(1);
  });

  it("keeps the rules the report design depends on", () => {
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("회사명을 가렸을 때");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("sourceIds");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("12개월");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("24개월");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("매수");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("최대 4개");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("CONTEXT_IRRELEVANT");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).not.toContain("점수");
  });
});
