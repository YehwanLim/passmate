import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./AiModelsPage.tsx", import.meta.url), "utf8");

describe("AiModelsPage model status", () => {
  it("renders server-provided model test results without performing direct data access", () => {
    expect(source).toContain("interface LiveModelStatus");
    expect(source).toContain("configPayload.liveStatuses");
    expect(source).toContain('liveStatus?.status === "failed"');
    expect(source).toContain('model.enabled && model.status === "connected"');
    expect(source).toContain("Live Check");
    expect(source).toContain("adminApiFetch");
    expect(source).not.toMatch(/\.from\(\s*["']/);
  });

  it("sends an explicit test-model action through the authenticated API helper", () => {
    expect(source).toContain('action: "test-model"');
    expect(source).toContain('adminApiFetch<TestResult>("/api/admin/ai-models"');
  });
});
