import { describe, expect, it } from "vitest";

import { buildCompanyReportFixture } from "../pages/companyReportFixture";
import { isRenderableCompanyReport } from "./companyReport";

describe("isRenderableCompanyReport", () => {
  it("accepts the fixture and a fixture without optional meta", () => {
    expect(isRenderableCompanyReport(buildCompanyReportFixture())).toBe(true);
    const { reportMeta: _meta, ...withoutMeta } = buildCompanyReportFixture();
    expect(isRenderableCompanyReport(withoutMeta)).toBe(true);
  });

  it.each([
    ["null", null],
    ["no brief", { ...buildCompanyReportFixture(), brief: undefined }],
    ["brief without oneLiner", { ...buildCompanyReportFixture(), brief: { keywords: [] } }],
    ["segments not an array", { ...buildCompanyReportFixture(), businessMap: { summary: "", segments: "x" } }],
    ["risks missing", { ...buildCompanyReportFixture(), opportunitiesAndRisks: { opportunities: [] } }],
    ["questions missing", { ...buildCompanyReportFixture(), interviewPrep: { primarySources: [] } }],
    ["sources not an array", { ...buildCompanyReportFixture(), sources: undefined }],
    ["résumé report shape", { companyInsight: {}, firstImpression: {}, strengths: [], gaps: [], questionTabs: [], actionPlan: [] }],
  ])("rejects %s", (_label, payload) => {
    expect(isRenderableCompanyReport(payload)).toBe(false);
  });
});
