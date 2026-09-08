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

  it("keeps the rules added after the first sample review", () => {
    // 섹션 간 같은 사실 재사용 금지, 07 은 02 와 다른 사업 포함
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("# [섹션 간 중복 금지]");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("focusBusinesses.items 에 없는 사업");
    // 인재상은 검색으로 확인한 회사 문구만, 못 찾으면 빈 배열. 금지 예시 단어를 프롬프트에 나열하지 않는다(모델이 그대로 베낀 사례)
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("translatedTalentKeywords 는 빈 배열");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).not.toContain("도전정신");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).not.toContain("주인의식");
    // 신입 수위·존칭 금지·공채 일정 제외
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("신입");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("회장님");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("공채 일정");
    // seedSentence 는 미완성구, 전망 문장 강조 금지, 라벨에 기간 금지, 날짜는 실제 사건 달
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("하고 싶습니다");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("할 것입니다");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("label 에 기간을 넣지 않는다");
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("사건이 실제로 일어난 달");
    // 계열사 사업을 이 회사 사업으로 쓰지 않는다(샘플에서 삼성SDS 데이터센터가 07 후보로 나온 사례)
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("다른 계열사");
    // 사내 의혹·복지 논란 같은 가십은 이슈·면접 질문에 쓰지 않는다(2단 프로브에서 주거 지원금 의혹이 면접 질문이 된 사례)
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("입 밖에 낼 수 없는 사건");
    // 04 는 02·05 와 다른 사건이되 직무와 관계있는 변화. 홍보성 사건으로 채우지 않는다(병렬 2단 프로브에서 ESG·포럼이 04 를 채운 사례)
    expect(COMPANY_REPORT_SYSTEM_PROMPT).toContain("홍보성 사건");
  });
});
