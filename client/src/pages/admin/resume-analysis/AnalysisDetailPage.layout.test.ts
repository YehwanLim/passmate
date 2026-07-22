import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("analysis detail split review layout", () => {
  it("uses a user-facing report preview as the default detail view", () => {
    const page = read(
      "client/src/pages/admin/resume-analysis/AnalysisDetailPage.tsx"
    );

    expect(page).toContain('defaultValue="preview"');
    expect(page).toContain("리포트 미리보기");
    expect(page).toContain("사용자 리포트 미리보기");
    expect(page).toContain("관리자 인사이트");
    expect(page).toContain("Raw JSON");
  });

  it("renders every project analysis as readable report feedback, not default JSON code", () => {
    const page = read(
      "client/src/pages/admin/resume-analysis/AnalysisDetailPage.tsx"
    );
    const hook = read("client/src/hooks/admin/useAnalysisDetail.ts");

    expect(page).toContain("문항별 리포트");
    expect(page).toContain("detail.project_analyses.map");
    expect(page).toContain("detail.input_text");
    expect(page).toContain("원문 비교");
    expect(page).toContain("toReportObject(analysis.ai_response_json)");
    expect(page).toContain('TabsContent value="raw"');
    expect(hook).toContain("project_id");
    expect(hook).toContain("project_analyses");
    expect(hook).toContain('.eq("project_id", r.project_id)');
  });

  it("renders the admin mock detail without calling Supabase", () => {
    const hook = read("client/src/hooks/admin/useAnalysisDetail.ts");
    const mock = read("client/src/hooks/admin/mockResumeAnalysis.ts");

    expect(hook).toContain('analysisId.startsWith("mock-analysis-")');
    expect(hook).toContain("setDetail({");
    expect(mock).toContain('id: "mock-analysis-1"');
    expect(mock).toContain("현대자동차 서비스 PM 지원");
  });
});
