import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const myProjectsSource = readFileSync(new URL("./MyProjects.tsx", import.meta.url), "utf8");
const projectsApiSource = readFileSync(new URL("../../../api/projects.js", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../utils/storage.ts", import.meta.url), "utf8");
const reportSource = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");
const analysisApiSource = readFileSync(new URL("../../../api/analysis/[id].js", import.meta.url), "utf8");
const viteConfigSource = readFileSync(new URL("../../../vite.config.ts", import.meta.url), "utf8");

describe("analysis persistence into My Projects", () => {
  it("persists a successful analysis to the projects API for the signed-in user", () => {
    expect(analyzeSource).toContain('fetch("/api/projects"');
    expect(analyzeSource).toContain("user?.id && user.email");
    expect(analyzeSource).toContain("analysisMeta: data.analysisMeta");
    expect(analyzeSource).toContain("savedProjectId");
    expect(analyzeSource).toContain("savedAnalysisId");
    expect(analyzeSource).toContain("projectId: savedProjectId");
    expect(analyzeSource).toContain("analysisId: savedAnalysisId");
  });

  it("loads My Projects for the current auth user instead of the first database user", () => {
    expect(myProjectsSource).toContain("useRequireAuth");
    expect(myProjectsSource).toContain("user?.id");
    expect(myProjectsSource).toContain("loadAnalysisFromStorage");
    expect(myProjectsSource).toContain("syncLatestLocalAnalysis");
    expect(myProjectsSource).toContain("latest.project_id");
    expect(myProjectsSource).toContain("saveAnalysisToStorage");
    expect(myProjectsSource).toContain("/api/projects?userId=");
    expect(projectsApiSource).toContain("req.query?.userId");
    expect(projectsApiSource).not.toContain("findFirst");
  });

  it("stores database ids alongside the latest local report cache", () => {
    expect(storageSource).toContain("analysisId?: string");
    expect(storageSource).toContain("analysis_id: params.analysisId");
    expect(storageSource).toContain("project_id: params.projectId");
  });

  it("opens the selected project's persisted report instead of the last local or mock report", () => {
    expect(myProjectsSource).toContain("project.latest_analysis_id");
    expect(myProjectsSource).toContain("analysisId=${encodeURIComponent(project.latest_analysis_id)}");
    expect(reportSource).toContain("requestedAnalysisId");
    expect(reportSource).toContain("fetch(`/api/analysis/${encodeURIComponent(requestedAnalysisId)}`)");
    expect(reportSource).toContain("setReportData(payload.ai_response_json as unknown as ReportData)");
    expect(analysisApiSource).toContain("project: {");
    expect(analysisApiSource).toContain("company_name: analysis.project?.company");
    expect(viteConfigSource).toContain("/api/analysis/");
    expect(viteConfigSource).toContain('api", "analysis", "[id].js"');
  });

  it("persists AI model, latency, and token usage metadata for admin analysis rows", () => {
    expect(projectsApiSource).toContain("normalizeAnalysisMeta");
    expect(projectsApiSource).toContain("req.body?.analysisMeta ?? aiResponseJson?.analysisMeta");
    expect(projectsApiSource).toContain("modelName: analysisMeta.modelName");
    expect(projectsApiSource).toContain("modelProvider: analysisMeta.modelProvider");
    expect(projectsApiSource).toContain("responseTime: analysisMeta.responseTimeMs");
    expect(projectsApiSource).toContain("tokenUsages: analysisMeta.tokenUsage");
    expect(projectsApiSource).toContain("promptTokens: analysisMeta.tokenUsage.promptTokens");
    expect(projectsApiSource).toContain("completionTokens: analysisMeta.tokenUsage.completionTokens");
    expect(projectsApiSource).toContain("totalTokens: analysisMeta.tokenUsage.totalTokens");
  });
});
