import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");

describe("ReportResult company upsell", () => {
  it("offers the company report for the same company, role, and analysis after the resume report", () => {
    expect(source).toContain("기업 분석 리포트 받기");
    expect(source).toContain("/company-analysis?company=${encodeURIComponent(targetCompany)}");
    expect(source).toContain("jobKeyword=${encodeURIComponent(targetJobRole)}");
    expect(source).toContain("resumeAnalysisId=${encodeURIComponent(activeAnalysisId ?? \"\")}");
  });

  it("reads the role from the analysis payload next to the company", () => {
    expect(source).toContain('setTargetJobRole(payload.job_role ?? "")');
  });

  it("keeps the upsell out of print", () => {
    const start = source.indexOf("기업 분석 리포트 받기");
    const sectionStart = source.lastIndexOf("<section", start);
    expect(source.slice(sectionStart, start)).toContain("print:hidden");
  });
});
