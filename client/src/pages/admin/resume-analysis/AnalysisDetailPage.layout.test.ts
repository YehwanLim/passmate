import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("analysis detail split review layout", () => {
  it("shows source essay and AI feedback side by side with a taller reading area", () => {
    const page = read(
      "client/src/pages/admin/resume-analysis/AnalysisDetailPage.tsx"
    );

    expect(page).toContain("원본 + 피드백");
    expect(page).toContain("lg:grid-cols-2");
    expect(page).toContain("AI 피드백");
    expect(page).toContain("h-[800px]");
    expect(page).toContain("min-h-[800px]");
  });

  it("shows every essay and report response for the selected project", () => {
    const page = read(
      "client/src/pages/admin/resume-analysis/AnalysisDetailPage.tsx"
    );
    const hook = read("client/src/hooks/admin/useAnalysisDetail.ts");

    expect(page).toContain('defaultValue="project"');
    expect(page).toContain("프로젝트 전체");
    expect(page).toContain("detail.project_analyses.map");
    expect(page).toContain("analysis.input_text");
    expect(page).toContain("analysis.ai_response_json");
    expect(hook).toContain("project_id");
    expect(hook).toContain("project_analyses");
    expect(hook).toContain('.eq("project_id", r.project_id)');
  });
});
