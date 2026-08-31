import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { UI_LABELS } from "./labels";

const surveySource = readFileSync(
  new URL("../../../lib/feedback-survey.js", import.meta.url),
  "utf8"
);
const entitlementsSource = readFileSync(
  new URL("../../../lib/analysis-entitlements.js", import.meta.url),
  "utf8"
);
const sectionSource = readFileSync(
  new URL("../components/FeedbackSection.tsx", import.meta.url),
  "utf8"
);

function numericConstant(source: string, name: string): number {
  const match = source.match(new RegExp(`export const ${name} = (\\d+);`));
  if (!match) throw new Error(`${name} is no longer exported`);
  return Number(match[1]);
}

function serverQuestionKeys(): string[] {
  const block = surveySource.match(
    /export const SURVEY_QUESTION_KEYS = Object\.freeze\(\[([\s\S]*?)\]\)/
  );
  if (!block) throw new Error("SURVEY_QUESTION_KEYS is no longer a frozen array literal");
  return [...block[1].matchAll(/"([a-zA-Z]+)"/g)].map(match => match[1]);
}

describe("feedback survey definition", () => {
  it("asks exactly the questions the server stores", () => {
    expect(UI_LABELS.FEEDBACK_SURVEY_QUESTIONS.map(item => item.key)).toEqual(
      serverQuestionKeys()
    );
  });

  it("shows the score range the server accepts", () => {
    expect(UI_LABELS.FEEDBACK_SCORE_MIN).toBe(
      numericConstant(surveySource, "SURVEY_SCORE_MIN")
    );
    expect(UI_LABELS.FEEDBACK_SCORE_MAX).toBe(
      numericConstant(surveySource, "SURVEY_SCORE_MAX")
    );
  });

  it("shows the comment length the server actually requires", () => {
    expect(UI_LABELS.FEEDBACK_MIN_COMMENT_LENGTH).toBe(
      numericConstant(surveySource, "SURVEY_MIN_COMMENT_LENGTH")
    );
  });

  it("promises the number of credits the server grants", () => {
    expect(numericConstant(entitlementsSource, "FEEDBACK_REWARD_CREDITS")).toBe(1);
    expect(UI_LABELS.FEEDBACK_REWARD_GRANTED_TITLE).toContain("1회");
  });

  it("derives the survey shape from the labels rather than hardcoding it", () => {
    expect(sectionSource).toContain("UI_LABELS.FEEDBACK_SURVEY_QUESTIONS");
    expect(sectionSource).toContain("UI_LABELS.FEEDBACK_MIN_COMMENT_LENGTH");
    expect(sectionSource).toContain("UI_LABELS.FEEDBACK_SCORE_MAX");
  });

  it("keeps every question wired to a stored column", () => {
    for (const item of UI_LABELS.FEEDBACK_SURVEY_QUESTIONS) {
      expect(surveySource).toContain(`${item.key}:`);
    }
  });
});
