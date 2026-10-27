import { describe, expect, it } from "vitest";

import { COMPANY_PENDING_STEPS, pickCompanyPendingStep } from "./companyPendingCopy";

describe("company pending copy", () => {
  it("keeps the steps in ascending time order with non-empty copy", () => {
    for (let index = 1; index < COMPANY_PENDING_STEPS.length; index += 1) {
      expect(COMPANY_PENDING_STEPS[index].afterMs).toBeGreaterThan(COMPANY_PENDING_STEPS[index - 1].afterMs);
    }
    for (const step of COMPANY_PENDING_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.lines.length).toBeGreaterThan(0);
    }
    expect(COMPANY_PENDING_STEPS[0].afterMs).toBe(0);
  });

  it("changes the message as time passes and stays on the last step afterwards", () => {
    const titles = [0, 14_999, 15_000, 45_000, 60_000, 90_000, 500_000].map((ms) => pickCompanyPendingStep(ms).title);
    expect(titles).toEqual([
      "공개 자료를 찾고 있어요",
      "공개 자료를 찾고 있어요",
      "사업 구조와 실적을 읽는 중이에요",
      "리포트 문장을 다듬고 있어요",
      "거의 다 됐어요",
      "평소보다 조금 더 걸리고 있어요",
      "평소보다 조금 더 걸리고 있어요",
    ]);
  });

  it("treats negative or invalid elapsed time as the first step", () => {
    expect(pickCompanyPendingStep(-5).title).toBe(COMPANY_PENDING_STEPS[0].title);
    expect(pickCompanyPendingStep(Number.NaN).title).toBe(COMPANY_PENDING_STEPS[0].title);
  });
});
