import { describe, expect, it } from "vitest";

import { isRenderableCompanyReport } from "@/types/companyReport";
import { COMPANY_REPORT_SAMPLE } from "./companyReportSample";
import { COMPANY_REPORT_SAMPLE_COMPANY } from "./companyReportSampleMeta";

describe("COMPANY_REPORT_SAMPLE", () => {
  it("is a renderable company report for a named company and role", () => {
    expect(COMPANY_REPORT_SAMPLE.company.trim().length).toBeGreaterThan(0);
    expect(COMPANY_REPORT_SAMPLE.jobRole.trim().length).toBeGreaterThan(0);
    expect(isRenderableCompanyReport(COMPANY_REPORT_SAMPLE.report)).toBe(true);
  });

  it("keeps the report's company name in sync with the landing-safe meta constant", () => {
    expect(COMPANY_REPORT_SAMPLE.company).toBe(COMPANY_REPORT_SAMPLE_COMPANY);
  });

  it("carries real sources with http(s) links and a report date", () => {
    const { report } = COMPANY_REPORT_SAMPLE;
    expect(report.sources.length).toBeGreaterThanOrEqual(5);
    for (const source of report.sources) {
      expect(source.url).toMatch(/^https?:\/\//);
    }
    expect(report.reportMeta?.kind).toBe("COMPANY");
    expect(report.reportMeta?.asOf ?? report.brief.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps the search entry point markup script-free", () => {
    const html = COMPANY_REPORT_SAMPLE.report.reportMeta?.searchEntryPointHtml ?? "";
    expect(html.toLowerCase()).not.toContain("<script");
  });

  it("does not link the sample to any user's resume analysis", () => {
    expect(COMPANY_REPORT_SAMPLE.report.reportMeta?.linkedResumeAnalysisId ?? null).toBeNull();
  });
});
