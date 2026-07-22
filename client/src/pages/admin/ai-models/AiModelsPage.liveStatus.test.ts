import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./AiModelsPage.tsx", import.meta.url), "utf8");

describe("AiModelsPage live model status", () => {
  it("uses provider live test results as the source of truth for healthy models", () => {
    expect(source).toContain("interface LiveModelStatus");
    expect(source).toContain("configPayload.liveStatuses");
    expect(source).toContain('liveStatus?.status === "failed"');
    expect(source).toContain('model.enabled && model.status === "connected"');
    expect(source).toContain("Live Check");
  });

  it("shows a clear error when the admin API returns the preview HTML shell", () => {
    expect(source).toContain('contentType.includes("application/json")');
    expect(source).toContain("JSON 대신 HTML");
    expect(source).toContain("dev 서버");
  });
});
