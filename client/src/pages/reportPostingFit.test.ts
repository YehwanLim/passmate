import { describe, expect, it } from "vitest";

import { isPostingFitRenderable } from "./reportPostingFit";

const match = { requirement: "데이터로 문제를 정의한 경험", status: "드러남" };

describe("isPostingFitRenderable", () => {
  it("rejects reports without posting fit (legacy or no job posting)", () => {
    expect(isPostingFitRenderable(undefined)).toBe(false);
    expect(isPostingFitRenderable(null)).toBe(false);
    expect(isPostingFitRenderable("text")).toBe(false);
    expect(isPostingFitRenderable({})).toBe(false);
  });

  it("rejects a posting fit with no requirement matches or no headline", () => {
    expect(isPostingFitRenderable({ headline: "h", verdict: "v", requirementMatches: [] })).toBe(false);
    expect(isPostingFitRenderable({ verdict: "v", requirementMatches: [match] })).toBe(false);
    expect(isPostingFitRenderable({ headline: 1, requirementMatches: [match] })).toBe(false);
  });

  it("accepts a posting fit with a headline and at least one match, optional blocks missing", () => {
    expect(isPostingFitRenderable({ headline: "h", verdict: "v", requirementMatches: [match] })).toBe(true);
  });
});
