import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const myProjectsSource = readFileSync(new URL("./MyProjects.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../utils/storage.ts", import.meta.url), "utf8");
const reportSource = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");

describe("analysis persistence into My Projects", () => {
  it("uses the server analysis transaction as the only persistence path", () => {
    expect(analyzeSource).toContain('fetch("/api/analyze"');
    expect(analyzeSource).toContain("parseAnalysisReceipt(await response.json())");
    expect(analyzeSource).toContain("analysisPendingPath(receipt.analysisRequestId)");
    expect(analyzeSource).not.toContain("data.project_id");
    expect(analyzeSource).not.toContain("data.analysis_id");
    expect(analyzeSource).not.toContain("data.report");
    expect(analyzeSource).not.toMatch(/fetch\("\/api\/projects",\s*\{\s*method:\s*"POST"/);
    expect(analyzeSource).not.toContain("analysisMeta: data.analysisMeta");
    expect(analyzeSource).not.toContain("saveAnalysisToStorage");
  });

  it("loads My Projects for the current auth user instead of the first database user", () => {
    expect(myProjectsSource).toContain("useRequireAuth");
    expect(myProjectsSource).toContain("getAuthorizationHeader");
    expect(myProjectsSource).not.toContain("loadAnalysisFromStorage");
    expect(myProjectsSource).not.toContain("syncLatestLocalAnalysis");
    expect(myProjectsSource).not.toContain("userId=");
  });

  it("does not cache analysis results in browser storage", () => {
    expect(storageSource).not.toContain("localStorage.setItem(STORAGE_KEYS.LATEST_ANALYSIS");
    expect(storageSource).not.toContain("sessionStorage.setItem(STORAGE_KEYS.SESSION_RESULT");
  });

  it("opens the selected project's persisted report instead of the last local or mock report", () => {
    expect(myProjectsSource).toContain("project.latest_analysis_id");
    expect(myProjectsSource).toContain("analysisId=${encodeURIComponent(project.latest_analysis_id)}");
    expect(reportSource).toContain("requestedAnalysisId");
    expect(reportSource).toContain("fetch(`/api/analysis/${encodeURIComponent(requestedAnalysisId)}`");
    expect(reportSource).toContain("setReportData(payload.ai_response_json as ReportData)");
  });

});
