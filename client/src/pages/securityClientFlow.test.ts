import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const projectsSource = readFileSync(new URL("./MyProjects.tsx", import.meta.url), "utf8");
const analysesSource = readFileSync(new URL("./MyAnalyses.tsx", import.meta.url), "utf8");
const reportSource = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");
const feedbackSource = readFileSync(new URL("../components/FeedbackSection.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../contexts/AuthContext.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../utils/storage.ts", import.meta.url), "utf8");
const supabaseSource = readFileSync(new URL("../lib/supabase.ts", import.meta.url), "utf8");

describe("authenticated client flow", () => {
  it("submits analysis once with auth, a random idempotency key, and the persisted response id", () => {
    expect(analyzeSource).toContain('import { getAuthorizationHeader } from "@/lib/apiAuth"');
    expect(analyzeSource).toContain('"Idempotency-Key": crypto.randomUUID()');
    expect(analyzeSource).toContain("data.report.questionTabs");
    expect(analyzeSource).toContain('navigate(`/report-new?analysisId=${encodeURIComponent(data.analysis_id)}`)');
    expect(analyzeSource).not.toMatch(/fetch\("\/api\/projects",\s*\{\s*method:\s*"POST"/);
    expect(analyzeSource).not.toContain("saveAnalysisToStorage");
  });

  it("uses authenticated own-data and feedback requests without client user ids or mock fallbacks", () => {
    for (const source of [projectsSource, analysesSource, reportSource, feedbackSource]) {
      expect(source).toContain("getAuthorizationHeader");
    }
    expect(projectsSource).not.toContain("userId=");
    expect(analysesSource).not.toContain("MOCK_");
    expect(projectsSource).not.toContain("MOCK_");
    expect(reportSource).not.toContain("FALLBACK_DATA");
    expect(reportSource).not.toContain("EMPTY_REPORT_DATA");
    expect(reportSource).toContain("useState<ReportData | null>(null)");
    expect(feedbackSource).not.toContain("userId,");
    expect(feedbackSource).not.toContain("getAnonymousUserId");
  });

  it("keeps the report DOM empty of report data until authentication resolves successfully", () => {
    expect(reportSource).toContain("if (authLoading)");
    expect(reportSource).toContain("if (!isAuthenticated)");
    expect(reportSource).toContain("로그인 후 분석 리포트를 확인할 수 있어요.");
  });

  it("keeps AuthContext to Supabase auth/OAuth only and clears legacy PassMate storage at logout", () => {
    expect(authSource).not.toContain('.from("users")');
    expect(authSource).not.toContain("user?.email");
    expect(authSource).toContain("clearPassMateStorage");
    expect(storageSource).toContain("export function clearPassMateStorage");
    expect(storageSource).not.toContain("localStorage.setItem(STORAGE_KEYS.LATEST_ANALYSIS");
    expect(storageSource).not.toContain("localStorage.setItem(STORAGE_KEYS.ANONYMOUS_USER_ID");
    expect(storageSource).not.toContain("localStorage.setItem(\n      STORAGE_KEYS.FEEDBACK_PREFIX");
    expect(supabaseSource).toContain("sole intentional browser-storage exception");
    expect(supabaseSource).toContain("HttpOnly BFF cookie");
  });

  it("does not write resume, report, or API error payloads to the browser console", () => {
    expect(analyzeSource).not.toContain("console.error(error)");
    expect(analyzeSource).not.toContain("리포트 구조가 아닙니다:");
    expect(feedbackSource).not.toContain('console.error("[FeedbackSection]');
    expect(authSource).not.toContain("console.error(\"[AuthContext]");
  });
});
