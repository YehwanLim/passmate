import { describe, expect, it } from "vitest";

import { isRenderableReport } from "@/pages/ReportResult";
import { tokenizeAnswerParagraph } from "@/pages/reportLineAnalysis";
import { isPostingFitRenderable } from "@/pages/reportPostingFit";
import type { DiagnosisEntry } from "@/types/report";

import { RESUME_REPORT_SAMPLE } from "./resumeReportSample";
import {
  RESUME_REPORT_SAMPLE_COMPANY,
  RESUME_REPORT_SAMPLE_JOB_POSTING,
  RESUME_REPORT_SAMPLE_JOB_ROLE,
} from "./resumeReportSampleMeta";

const { report } = RESUME_REPORT_SAMPLE;
const boldCount = (text: string) => (text.match(/\*\*[^*]+\*\*/g) ?? []).length;

// 리포트가 지원자를 평가하는 문장들. 지원자 원문(fullAnswer·original)과 그 고쳐 쓴 문장(suggestion)은
// 지원자 본인의 수치를 인용하므로 뺀다.
function evaluativeTexts(): string[] {
  return [
    ...Object.values(report.companyInsight).flat(),
    ...Object.values(report.firstImpression).flat().map((value) => (typeof value === "string" ? value : JSON.stringify(value))),
    ...[...report.strengths, ...report.gaps].map((entry) => JSON.stringify(entry)),
    ...Object.values(report.positioning),
    ...report.questionTabs.flatMap((tab) => [
      tab.overview,
      tab.subtitleDiagnosis.feedback,
      ...tab.feedbackCards.flatMap((card) => [card.feedback ?? "", card.praisePoint ?? "", card.detailedAnalysis ?? ""]),
    ]),
    ...report.interviewQA.map((qa) => JSON.stringify(qa)),
    ...report.actionPlan.map((item) => JSON.stringify(item)),
    report.pmComment,
    ...(report.postingFit
      ? [
          report.postingFit.headline,
          report.postingFit.verdict,
          ...report.postingFit.requirementMatches.map((match) => JSON.stringify(match)),
          ...(report.postingFit.missingKeywords ?? []),
          ...(report.postingFit.questionAdvice ?? []).map((item) => item.advice),
        ]
      : []),
  ];
}

describe("public résumé sample report", () => {
  it("passes the same render guard as a stored report and stays in sync with the landing label", () => {
    expect(isRenderableReport(report)).toBe(true);
    expect(RESUME_REPORT_SAMPLE.company).toBe(RESUME_REPORT_SAMPLE_COMPANY);
    expect(RESUME_REPORT_SAMPLE.jobRole).toBe(RESUME_REPORT_SAMPLE_JOB_ROLE);
  });

  it("highlights only sentences that exist in the answer, with 4-8 cards and at least one praise per question", () => {
    for (const tab of report.questionTabs) {
      expect(tab.feedbackCards.length).toBeGreaterThanOrEqual(4);
      expect(tab.feedbackCards.length).toBeLessThanOrEqual(8);
      expect(tab.feedbackCards.some((card) => card.type === "praise")).toBe(true);
      for (const card of tab.feedbackCards) {
        expect(tab.fullAnswer).toContain(card.original);
        expect(card.detailedAnalysis).toBeTruthy();
        if (card.type === "improvement") expect(card.suggestion).toBeTruthy();
      }
      if (tab.subtitleDiagnosis.exists) expect(tab.fullAnswer).toContain(tab.subtitleDiagnosis.original);

      // 화면(LineAnalysisSection)과 같은 토크나이저로 문단별로 잘라, 모든 카드가 하이라이트로 붙는지 본다.
      const highlights = tab.feedbackCards.map((card) => card.original);
      const subtitle = tab.subtitleDiagnosis.original.trim();
      const tokens = tab.fullAnswer.split("\n").flatMap((paragraph) => tokenizeAnswerParagraph(paragraph, highlights, subtitle));
      const highlightedCards = tokens.flatMap((token) => (token.kind === "card" ? [token.cardIndex] : []));
      expect([...highlightedCards].sort()).toEqual(highlights.map((_, index) => index));
      if (subtitle) expect(tokens.some((token) => token.kind === "subtitle")).toBe(true);
    }
  });

  it("follows the master prompt's first-impression, emphasis and count rules", () => {
    const { firstImpression } = report;
    expect(firstImpression.persona.length).toBeLessThanOrEqual(28);
    expect(firstImpression.summaryOneLiner.length).toBeLessThanOrEqual(70);
    expect(firstImpression.hiringMemory?.map((item) => item.mark)).toEqual(["✓", "✓", "✓", "△"]);
    for (const item of firstImpression.hiringMemory ?? []) expect(item.text.length).toBeLessThanOrEqual(30);
    // 상단 카드에는 강조 표시를 쓰지 않는다.
    expect(JSON.stringify(firstImpression)).not.toContain("**");

    for (const entry of [...report.strengths, ...report.gaps] as DiagnosisEntry[]) {
      expect(entry.headline.length).toBeLessThanOrEqual(20);
      expect(boldCount(entry.text)).toBe(1);
    }
    expect(report.interviewQA.length).toBeGreaterThanOrEqual(5);
    for (const qa of report.interviewQA) {
      expect(qa.followUps.length).toBeGreaterThanOrEqual(2);
      expect(qa.followUps.length).toBeLessThanOrEqual(3);
      expect(boldCount(qa.modelAnswer)).toBe(1);
    }
    expect(report.pmComment.split(/\n\s*\n/)).toHaveLength(3);
    expect(boldCount(report.pmComment)).toBe(1);
  });

  it("carries a posting fit that matches the sample job posting and covers every question", () => {
    const { postingFit } = report;
    expect(isPostingFitRenderable(postingFit)).toBe(true);
    expect(RESUME_REPORT_SAMPLE.jobPosting).toBe(RESUME_REPORT_SAMPLE_JOB_POSTING);
    expect(RESUME_REPORT_SAMPLE_JOB_POSTING.summary.company).toBe(RESUME_REPORT_SAMPLE_COMPANY);
    expect(RESUME_REPORT_SAMPLE_JOB_POSTING.summary.role).toBe(RESUME_REPORT_SAMPLE_JOB_ROLE);

    // 대조 항목은 공고 요구사항에서 그대로 가져오고, 세 상태를 모두 한 번씩은 보여 준다.
    for (const match of postingFit!.requirementMatches) {
      expect(RESUME_REPORT_SAMPLE_JOB_POSTING.summary.requirements).toContain(match.requirement);
    }
    expect(new Set(postingFit!.requirementMatches.map((match) => match.status))).toEqual(new Set(["드러남", "약함", "언급 없음"]));
    // 빠진 키워드는 공고 키워드에 있고, 문항별 조언은 fixture 의 문항 탭마다 하나씩이다.
    for (const keyword of postingFit!.missingKeywords ?? []) {
      expect(RESUME_REPORT_SAMPLE_JOB_POSTING.summary.keywords).toContain(keyword);
    }
    expect((postingFit!.questionAdvice ?? []).map((item) => item.questionIndex)).toEqual(report.questionTabs.map((tab) => tab.id));
  });

  it("never grades the applicant with scores or percentages, and never calls itself 첨삭", () => {
    for (const text of evaluativeTexts()) {
      expect(text).not.toMatch(/점수|적합도|합격률|%|첨삭|것 같습니다/);
    }
  });
});
