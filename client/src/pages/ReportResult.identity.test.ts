import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");

describe("ReportResult identity display", () => {
  it("prefers the saved site profile name before auth fallback names", () => {
    expect(source).toContain('supabase');
    expect(source).toContain('.from("users")');
    expect(source).toContain('.select("name")');
    expect(source).toContain("getFallbackDisplayName(user)");
    expect(source).toContain("user?.name");
    expect(source).toContain('user?.email?.split("@")[0]');
    expect(source).toContain('return "지원자"');
  });

  it("does not expose the development API test control on the result page", () => {
    expect(source).not.toContain("handleApiTest");
    expect(source).not.toContain("test-gemini");
    expect(source).not.toContain("UI_LABELS.API_TEST");
  });

  it("renders mentor comments as labeled editorial blocks with keyword emphasis", () => {
    expect(source).toContain('"읽힌 인상"');
    expect(source).toContain('"더 선명해질 지점"');
    expect(source).toContain('"면접에서 준비할 것"');
    expect(source).toContain("tokenizeCommentKeywords");
    expect(source).toContain("text-indigo-200");
  });
});
