import { describe, expect, it } from "vitest";
import { createMockPromptRun, nextPromptVersion } from "./admin-prompts";

describe("nextPromptVersion", () => {
  it("starts a prompt type at v1.0", () => {
    expect(nextPromptVersion([])).toBe("v1.0");
  });

  it("increments the largest minor version", () => {
    expect(nextPromptVersion(["v1.0", "v1.2", "v2.0"])).toBe("v2.1");
  });
});

describe("createMockPromptRun", () => {
  it("does not require a provider request and returns usage metadata", () => {
    const result = createMockPromptRun("지원자 이력서", "Resume Analysis");

    expect(result.response).toContain("Resume Analysis");
    expect(result.responseTimeMs).toBeGreaterThan(0);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.estimatedCost).toBeGreaterThan(0);
  });
});
