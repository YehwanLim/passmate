import { describe, expect, it } from "vitest";

import { COMPANY_PENDING_STEPS, pickCompanyPendingStep } from "./companyPendingCopy";
import { RESUME_PENDING_STEPS } from "./resumePendingCopy";

describe("resume pending copy", () => {
  it("starts at 0ms, keeps steps in ascending order, and gives every step its own icon and text", () => {
    expect(RESUME_PENDING_STEPS[0].afterMs).toBe(0);
    for (let index = 1; index < RESUME_PENDING_STEPS.length; index += 1) {
      expect(RESUME_PENDING_STEPS[index].afterMs).toBeGreaterThan(RESUME_PENDING_STEPS[index - 1].afterMs);
    }
    for (const steps of [RESUME_PENDING_STEPS, COMPANY_PENDING_STEPS]) {
      expect(new Set(steps.map((step) => step.icon)).size).toBe(steps.length);
      for (const step of steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.lines.length).toBeGreaterThan(0);
      }
    }
  });

  it("changes the message as a résumé analysis runs and stays on the last step afterwards", () => {
    const titles = [0, 20_000, 60_000, 100_000, 500_000].map((ms) => pickCompanyPendingStep(ms, RESUME_PENDING_STEPS).title);
    expect(titles).toEqual([
      "자소서를 처음부터 읽고 있어요",
      "첫인상을 정리하는 중이에요",
      "문장마다 코멘트를 달고 있어요",
      "리포트를 마무리하고 있어요",
      "평소보다 조금 더 걸리고 있어요",
    ]);
  });
});
