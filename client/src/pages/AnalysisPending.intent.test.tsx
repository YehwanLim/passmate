// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useAuth: vi.fn(),
  getAuthorizationHeader: vi.fn(async () => ({ Authorization: "Bearer t" })),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/analysis-pending", mocks.navigate],
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("@/lib/apiAuth", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));

import AnalysisPending from "./AnalysisPending";

function statusResponse(body: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      id: "req-1",
      requestId: "rid-1",
      analysis_id: null,
      error: null,
      kind: "RESUME",
      ...body,
    }),
    { status: 200 }
  );
}

// 면접 후기 글에서 온 분석(?intent=interview)은 폴링이 끝나 리포트로 넘어갈 때도 intent 를 잇는다.
describe("AnalysisPending intent", () => {
  beforeEach(() => {
    mocks.useAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
    mocks.navigate.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the resume report with intent=interview after polling succeeds", async () => {
    window.history.replaceState(
      {},
      "",
      "/analysis-pending?requestId=req-1&intent=interview"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        statusResponse({ status: "SUCCEEDED", analysis_id: "an-1" })
      )
    );
    render(<AnalysisPending />);

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/report-new?analysisId=an-1&intent=interview"
      )
    );
  });

  it("opens the resume report without intent for an ordinary analysis", async () => {
    window.history.replaceState({}, "", "/analysis-pending?requestId=req-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        statusResponse({ status: "SUCCEEDED", analysis_id: "an-1" })
      )
    );
    render(<AnalysisPending />);

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/report-new?analysisId=an-1")
    );
  });

  it("does not attach intent to a company report", async () => {
    window.history.replaceState(
      {},
      "",
      "/analysis-pending?requestId=req-1&intent=interview"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        statusResponse({
          status: "SUCCEEDED",
          analysis_id: "an-1",
          kind: "COMPANY",
        })
      )
    );
    render(<AnalysisPending />);

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith(
        "/company-report?analysisId=an-1"
      )
    );
  });

  it("keeps intent on the 새 분석 시작 button after a failed analysis", async () => {
    window.history.replaceState(
      {},
      "",
      "/analysis-pending?requestId=req-1&intent=interview"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        statusResponse({ status: "FAILED", error: "ANALYSIS_FAILED" })
      )
    );
    render(<AnalysisPending />);

    (await screen.findByRole("button", { name: "새 분석 시작" })).click();
    expect(mocks.navigate).toHaveBeenCalledWith("/analyze?intent=interview");
  });
});
