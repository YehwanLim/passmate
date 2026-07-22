import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("resume analysis table navigation", () => {
  it("makes the project cell navigate to the analysis detail page", () => {
    const table = read("client/src/components/admin/resume-analysis/AnalysesTable.tsx");

    expect(table).toContain("{/* 프로젝트 */}");
    expect(table).toContain("useLocation");
    expect(table).toContain("onClick={() => navigate(`/admin/resume-analysis/${r.id}`)}");
    expect(table).toContain('href={`/admin/resume-analysis/${r.id}`}');
    expect(table).toContain('className="block px-4 py-3"');
    expect(table).toContain("r.project_job_keyword");
    expect(table).toContain("r.total_chars");
  });

  it("loads job keyword and character count for the project summary", () => {
    const hook = read("client/src/hooks/admin/useAnalysesData.ts");
    const api = read("api/admin/resume-analysis.js");

    expect(hook).toContain("/api/admin/resume-analysis?");
    expect(hook).toContain("project_job_keyword");
    expect(api).toContain("project_job_keyword");
    expect(api).toContain("total_chars: analysis.totalChars ?? null");
    expect(api).toContain("prisma.analysis.findMany");
  });

  it("uses My page mock data as an admin fallback when the list is empty", () => {
    const hook = read("client/src/hooks/admin/useAnalysesData.ts");
    const detailHook = read("client/src/hooks/admin/useAnalysisDetail.ts");
    const mock = read("client/src/hooks/admin/mockResumeAnalysis.ts");

    expect(hook).toContain("MOCK_ADMIN_ANALYSIS_ROWS");
    expect(hook).toContain("VITE_HIDE_ADMIN_MOCKS");
    expect(hook).toContain("withMockRows(processed)");
    expect(detailHook).toContain('analysisId.startsWith("mock-analysis-")');
    expect(mock).toContain("현대자동차 서비스 PM 지원");
  });

  it("does not render the unused score column", () => {
    const table = read("client/src/components/admin/resume-analysis/AnalysesTable.tsx");
    const filters = read("client/src/components/admin/resume-analysis/AnalysesFilters.tsx");

    expect(table).not.toContain("<TableHead className=\"hidden xl:table-cell w-[60px] text-right\">점수</TableHead>");
    expect(table).not.toContain("{/* AI 점수 */}");
    expect(filters).not.toContain("AI 점수");
  });
});
