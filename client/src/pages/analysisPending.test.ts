import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AnalysisPending.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("AnalysisPending", () => {
  it("polls the protected status endpoint and opens the report only after success", () => {
    expect(source).toContain('fetch(`/api/analysis-requests/${encodeURIComponent(requestId)}`');
    expect(source).toContain("headers: await getAuthorizationHeader()");
    expect(source).toContain("setTimeout(poll, 3000)");
    expect(source).toContain('navigate(`/report-new?analysisId=${encodeURIComponent(status.analysisId)}`)');
    expect(source).toContain('status.status === "SUCCEEDED"');
    expect(source).toContain('status.status === "FAILED"');
  });

  it("keeps report data and browser storage out of the waiting view", () => {
    expect(source).not.toContain("ai_response_json");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("providerResult");
  });

  it("gives a contact route out of the failure view", () => {
    expect(source).toContain('href="mailto:hansitoring@gmail.com"');
  });

  it("registers the pending route before the report route", () => {
    expect(appSource.indexOf('path={"/analysis-pending"}'))
      .toBeLessThan(appSource.indexOf('path={"/report-new"}'));
  });
});
