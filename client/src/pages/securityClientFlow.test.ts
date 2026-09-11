import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const projectsSource = readFileSync(new URL("./MyProjects.tsx", import.meta.url), "utf8");
const analysesSource = readFileSync(new URL("./MyAnalyses.tsx", import.meta.url), "utf8");
const reportSource = readFileSync(new URL("./ReportResult.tsx", import.meta.url), "utf8");
// 설문 제출은 FeedbackSurveyForm 이 한다. FeedbackSection 은 리포트 하단 안내일 뿐이다.
const feedbackSource = readFileSync(new URL("../components/FeedbackSurveyForm.tsx", import.meta.url), "utf8");
const feedbackTeaserSource = readFileSync(new URL("../components/FeedbackSection.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../contexts/AuthContext.tsx", import.meta.url), "utf8");
const storageSource = readFileSync(new URL("../utils/storage.ts", import.meta.url), "utf8");
const supabaseSource = readFileSync(new URL("../lib/supabase.ts", import.meta.url), "utf8");
// 접수 POST 자체는 자소서·기업 분석이 함께 쓰는 lib/analysisSubmit.ts 가 한다.
const submitSource = readFileSync(new URL("../lib/analysisSubmit.ts", import.meta.url), "utf8");
// 저장된 리포트 조회와 로그인 게이트도 두 리포트가 함께 쓴다.
const reportLoaderSource = readFileSync(new URL("../hooks/useAnalysisReport.ts", import.meta.url), "utf8");
const reportAuthGateSource = readFileSync(new URL("../components/report/ReportAuthGate.tsx", import.meta.url), "utf8");

describe("authenticated client flow", () => {
  it("uses the same idempotency key for a retry of unchanged analysis input and sends its receipt to the protected pending page", () => {
    expect(submitSource).toContain('import { getAuthorizationHeader } from "@/lib/apiAuth"');
    expect(analyzeSource).toContain("const analysisRequestRef = useRef");
    expect(analyzeSource).toContain("resolveIdempotencyKey(analysisRequestRef.current, JSON.stringify(requestPayload))");
    expect(submitSource).toContain('"Idempotency-Key": idempotencyKey');
    expect(submitSource).toContain("parseAnalysisReceipt(await response.json())");
    expect(analyzeSource).toContain("analysisPendingPath(result.receipt.analysisRequestId)");
    expect(analyzeSource).not.toContain("data.report.questionTabs");
    expect(analyzeSource).not.toContain('navigate(`/report-new?analysisId=${encodeURIComponent(data.analysis_id)}`)');
    expect(analyzeSource).not.toMatch(/fetch\("\/api\/projects",\s*\{\s*method:\s*"POST"/);
    expect(analyzeSource).not.toContain("saveAnalysisToStorage");
  });

  it("uses authenticated own-data and feedback requests without client user ids or mock fallbacks", () => {
    for (const source of [projectsSource, analysesSource, reportLoaderSource, feedbackSource]) {
      expect(source).toContain("getAuthorizationHeader");
    }
    expect(projectsSource).not.toContain("userId=");
    expect(analysesSource).not.toContain("MOCK_");
    expect(projectsSource).not.toContain("MOCK_");
    expect(reportSource).not.toContain("FALLBACK_DATA");
    expect(reportSource).not.toContain("EMPTY_REPORT_DATA");
    expect(reportLoaderSource).toContain("useState<T | null>(null)");
    expect(feedbackSource).not.toContain("userId,");
    expect(feedbackSource).not.toContain("getAnonymousUserId");
    // 안내 카드는 아무것도 제출하지 않는다.
    expect(feedbackTeaserSource).not.toContain("/api/feedback");
    expect(feedbackTeaserSource).not.toContain("getAnonymousUserId");
  });

  it("keeps the report DOM empty of report data until authentication resolves successfully", () => {
    expect(reportAuthGateSource).toContain("if (isLoading)");
    expect(reportAuthGateSource).toContain("if (!isAuthenticated)");
    expect(reportSource).toContain("<ReportAuthGate");
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
