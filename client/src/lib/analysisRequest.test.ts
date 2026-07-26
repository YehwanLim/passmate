import { describe, expect, it } from "vitest";

import {
  analysisPendingPath,
  parseAnalysisReceipt,
  parseAnalysisRequestStatus,
} from "./analysisRequest";

describe("analysis request browser contracts", () => {
  it("parses an accepted analysis receipt without a report payload", () => {
    expect(parseAnalysisReceipt({
      analysis_request_id: "request-1",
      analysis_id: "analysis-1",
      project_id: "project-1",
      requestId: "request-id",
      status: "PENDING",
    })).toEqual({
      analysisRequestId: "request-1",
      analysisId: "analysis-1",
      projectId: "project-1",
      requestId: "request-id",
      status: "PENDING",
    });
  });

  it("rejects a response that tries to substitute a report for a receipt", () => {
    expect(() => parseAnalysisReceipt({ report: { secret: "do not render" } }))
      .toThrow("INVALID_ANALYSIS_RECEIPT");
  });

  it("parses only the safe status projection", () => {
    expect(parseAnalysisRequestStatus({
      analysis_id: "analysis-1",
      error: null,
      id: "request-1",
      requestId: "request-id",
      status: "SUCCEEDED",
    })).toEqual({
      analysisId: "analysis-1",
      error: null,
      id: "request-1",
      requestId: "request-id",
      status: "SUCCEEDED",
    });
  });

  it("rejects a status response with an unsafe terminal error", () => {
    expect(() => parseAnalysisRequestStatus({
      analysis_id: null,
      error: "provider raw error",
      id: "request-1",
      requestId: "request-id",
      status: "FAILED",
    })).toThrow("INVALID_ANALYSIS_REQUEST_STATUS");
  });

  it("rejects a non-string error value instead of treating it as a safe null", () => {
    expect(() => parseAnalysisRequestStatus({
      analysis_id: null,
      error: false,
      id: "request-1",
      requestId: "request-id",
      status: "CALLING",
    })).toThrow("INVALID_ANALYSIS_REQUEST_STATUS");
  });

  it("encodes a request ID in the pending page URL", () => {
    expect(analysisPendingPath("request/id?x=1")).toBe(
      "/analysis-pending?requestId=request%2Fid%3Fx%3D1",
    );
  });
});
