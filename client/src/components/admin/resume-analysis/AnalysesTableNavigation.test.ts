import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("resume analysis table navigation", () => {
  it("makes the project cell navigate to the analysis detail page", () => {
    const table = read("client/src/components/admin/resume-analysis/AnalysesTable.tsx");

    expect(table).toContain("{/* 프로젝트 */}");
    expect(table).toContain('<Link href={`/admin/resume-analysis/${r.id}`}>');
    expect(table).toContain("r.project_job_keyword");
    expect(table).toContain("r.total_chars");
  });

  it("loads job keyword and character count for the project summary", () => {
    const hook = read("client/src/hooks/admin/useAnalysesData.ts");

    expect(hook).toContain("projects(title, company, job_keyword)");
    expect(hook).toContain("project_job_keyword");
    expect(hook).toContain("total_chars: r.total_chars ?? null");
  });
});
