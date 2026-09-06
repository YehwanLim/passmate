import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CompanyAnalyze.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("CompanyAnalyze page", () => {
  it("posts to the company route with an idempotency key and moves to the pending page", () => {
    expect(source).toContain('fetch("/api/analyze/company", {');
    expect(source).toContain('"Idempotency-Key": idempotencyKey');
    expect(source).toContain("navigate(analysisPendingPath(receipt.analysisRequestId))");
    expect(source).toContain('trackAnalysisStart("company_report"');
  });

  it("reuses the shared comboboxes and the company error mapper", () => {
    expect(source).toContain('from "@/components/analyze/CompanyCombobox"');
    expect(source).toContain('from "@/components/analyze/JobRoleCombobox"');
    expect(source).toContain("getCompanyAnalyzeError(errorData, response.status)");
  });

  it("keeps identifiers out of browser storage and the URL body", () => {
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("userId=");
  });

  it("limits the pasted posting to 4,000 characters and lists only résumé projects for linking", () => {
    expect(source).toContain("MAX_POSTING_CHARS = 4000");
    expect(source).toContain('project.kind !== "COMPANY"');
  });

  it("is routed at /company-analysis after /analysis-pending", () => {
    expect(appSource).toContain('path={"/company-analysis"} component={CompanyAnalyze}');
    expect(appSource.indexOf('path={"/analysis-pending"}')).toBeLessThan(appSource.indexOf('path={"/company-analysis"}'));
  });
});
