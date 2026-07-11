import { describe, expect, it } from "vitest";
import {
  buildActivationUpdates,
  buildDraftRecord,
  createMockPromptRun,
  nextPromptVersion,
  PROMPT_TYPES,
} from "./admin-prompts";

describe("PROMPT_TYPES", () => {
  it("matches the supported admin prompt types exactly", () => {
    expect(PROMPT_TYPES).toEqual([
      "resume-analysis",
      "cover-letter",
      "summary",
      "feedback",
      "interview-questions",
    ]);
  });
});

describe("nextPromptVersion", () => {
  it("starts a prompt type at v1.0", () => {
    expect(nextPromptVersion([])).toBe("v1.0");
  });

  it("increments the largest minor version", () => {
    expect(nextPromptVersion(["v1.0", "v1.2", "v2.0"])).toBe("v2.1");
  });
});

describe("buildDraftRecord", () => {
  it("creates a draft with the next version and inactive status", () => {
    const draft = buildDraftRecord({
      type: "summary",
      versions: ["v1.0"],
      name: "Summary",
      systemPrompt: "system",
      userTemplate: "{{resume}}",
      temperature: 0.4,
      maxTokens: 800,
      notes: "Shorter output",
      updatedBy: "admin@passmate.ai",
    });

    expect(draft.version).toBe("v1.1");
    expect(draft.is_active).toBe(false);
    expect(draft.prompt_type).toBe("summary");
  });
});

describe("buildActivationUpdates", () => {
  it("targets only matching prompt type records when activating", () => {
    expect(buildActivationUpdates("feedback", "selected-id")).toEqual({
      deactivate: { prompt_type: "feedback", is_active: false },
      activateId: "selected-id",
    });
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
