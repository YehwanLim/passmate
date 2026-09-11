import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");
const submitSource = readFileSync(new URL("../lib/analysisSubmit.ts", import.meta.url), "utf8");

describe("analysis authentication access", () => {
  it("lets visitors fill the form but asks for login at submit, and still sends the Supabase access token", () => {
    // 폼은 공개, 로그인은 제출 순간(AnalyzeLoginModal). 권한 경계는 서버(/api/analyze)가 지킨다.
    expect(analyzeSource).not.toContain("useRequireAuth(");
    expect(analyzeSource).toContain("<AnalyzeLoginModal");
    expect(analyzeSource).toContain("if (!isAuthenticated) {");
    expect(analyzeSource).toContain("getAuthorizationHeader()");
    expect(analyzeSource).toContain('submitAnalysisRequest("/api/analyze"');
    expect(submitSource).toContain("getAuthorizationHeader()");
    expect(submitSource).toContain('kind: "auth_required"');
  });

  it("tells users that logging in enables free analysis", () => {
    expect(loginSource).toContain("로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.");
  });
});
