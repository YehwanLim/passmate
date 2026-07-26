import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  formatSocialProofMetric,
  SocialProofMetricCard,
} from "./SocialProofMetric";

describe("SocialProofMetricCard", () => {
  const metric = {
    id: "analyzed-cover-letters",
    value: 2000,
    suffix: "+",
    label: "분석 완료 자소서",
  } as const;

  it("formats grouped counts and renders the inactive counter at zero", () => {
    expect(formatSocialProofMetric(2000)).toBe("2,000");
    expect(
      renderToStaticMarkup(
        <SocialProofMetricCard metric={metric} isActive={false} />
      )
    ).toContain("0+");
  });
});
