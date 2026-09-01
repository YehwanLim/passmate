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
const formSource = readFileSync(
  new URL("../components/FeedbackSurveyForm.tsx", import.meta.url),
  "utf8"
);
const teaserSource = readFileSync(
  new URL("../components/FeedbackSection.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(
  new URL("../App.tsx", import.meta.url),
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
    expect(formSource).toContain("UI_LABELS.FEEDBACK_SURVEY_QUESTIONS");
    expect(formSource).toContain("UI_LABELS.FEEDBACK_MIN_COMMENT_LENGTH");
    expect(formSource).toContain("UI_LABELS.FEEDBACK_SCORE_MAX");
  });

  it("keeps the survey off the report page and behind its own route", () => {
    // 리포트 하단에는 안내만 둔다. 설문 본문이 다시 새어 들어오면 실패한다.
    expect(teaserSource).not.toContain("FEEDBACK_SURVEY_QUESTIONS");
    expect(teaserSource).toContain("/feedback?analysisId=");
    expect(appSource).toContain('path={"/feedback"}');
  });

  it("only promises the credit while the account can still receive it", () => {
    // 계정당 1회라, 이미 받은 사람에게 보상 문구를 띄우면 지키지 못할 약속이 된다.
    expect(teaserSource).toContain("feedbackRewardClaimed");
    expect(teaserSource).toContain("FEEDBACK_TEASER_CTA_REWARD");
    expect(teaserSource).toContain("FEEDBACK_TEASER_CTA_PLAIN");
  });

  it("keeps every question wired to a stored column", () => {
    for (const item of UI_LABELS.FEEDBACK_SURVEY_QUESTIONS) {
      expect(surveySource).toContain(`${item.key}:`);
    }
  });
});
