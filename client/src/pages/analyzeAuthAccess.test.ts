import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const analyzeSource = readFileSync(new URL("./Analyze.tsx", import.meta.url), "utf8");
const loginSource = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");

describe("analysis authentication access", () => {
  it("guards the analysis route and attaches the Supabase access token", () => {
    expect(analyzeSource).toContain('useRequireAuth({ redirectPath: "/analyze" })');
    expect(analyzeSource).toContain("Authorization: `Bearer ${session.access_token}`");
    expect(analyzeSource).toContain("if (response.status === 401)");
    expect(analyzeSource).toContain('navigate("/login?redirect=/analyze")');
  });

  it("tells users that logging in enables free analysis", () => {
    expect(loginSource).toContain("로그인만 하면 무료로 자소서 분석을 시작할 수 있어요.");
  });
});
