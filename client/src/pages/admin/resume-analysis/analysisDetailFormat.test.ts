import { describe, expect, it } from "vitest";

import { stripEmphasisDeep } from "./analysisDetailFormat";

describe("stripEmphasisDeep", () => {
  it("리포트 안의 모든 문자열에서 ** 강조 표시를 뗀다", () => {
    const report = {
      pmComment: "**면접에서는 구현 관점으로 설명한다면** 좋아요.",
      firstImpression: { hashtags: ["**#협업**", "#분석"] },
      actionPlan: [{ title: "**첫 단계**", priority: 1 }],
    };

    expect(stripEmphasisDeep(report)).toEqual({
      pmComment: "면접에서는 구현 관점으로 설명한다면 좋아요.",
      firstImpression: { hashtags: ["#협업", "#분석"] },
      actionPlan: [{ title: "첫 단계", priority: 1 }],
    });
  });

  it("문자열이 아닌 값과 null 은 그대로 둔다", () => {
    expect(stripEmphasisDeep(null)).toBeNull();
    expect(stripEmphasisDeep({ count: 3, ok: true, none: null })).toEqual({ count: 3, ok: true, none: null });
  });
});
