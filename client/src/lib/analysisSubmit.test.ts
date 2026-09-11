import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizationHeader: vi.fn(async () => ({ Authorization: "Bearer test-token" })),
}));

vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));

import { AuthenticationRequiredError } from "@/lib/apiAuth";
import { resolveIdempotencyKey, submitAnalysisRequest } from "./analysisSubmit";

const RECEIPT = {
  analysis_request_id: "req-1",
  analysis_id: "analysis-1",
  project_id: "project-1",
  requestId: "trace-1",
  status: "PENDING",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("resolveIdempotencyKey", () => {
  it("reuses the key for an unchanged payload and issues a new one when the payload changes", () => {
    const first = resolveIdempotencyKey(null, "a");
    expect(resolveIdempotencyKey(first, "a").idempotencyKey).toBe(first.idempotencyKey);
    expect(resolveIdempotencyKey(first, "b").idempotencyKey).not.toBe(first.idempotencyKey);
  });
});

describe("submitAnalysisRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the idempotency key with the bearer token and returns the parsed receipt", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(RECEIPT, 202));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitAnalysisRequest("/api/analyze", { questions: [] }, "key-1");

    expect(result).toEqual({
      kind: "accepted",
      receipt: expect.objectContaining({ analysisRequestId: "req-1", status: "PENDING" }),
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Idempotency-Key": "key-1",
    });
  });

  it("classifies non-202 responses as rejected and keeps the server error body for the caller", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "RATE_LIMITED" }, 429)));

    await expect(submitAnalysisRequest("/api/analyze", {}, "key")).resolves.toEqual({
      kind: "rejected",
      status: 429,
      errorData: { error: "RATE_LIMITED" },
    });
  });

  it("reports a parse error when an accepted response is not a receipt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ report: {} }, 202)));

    await expect(submitAnalysisRequest("/api/analyze", {}, "key")).resolves.toEqual({
      kind: "parse_error",
    });
  });

  it("asks for login instead of blaming the network when there is no session", async () => {
    // 비로그인도 /analyze 폼을 쓸 수 있어 이 경로가 실제로 열린다. 예전엔 "네트워크가 불안정해요"로 보였다.
    mocks.getAuthorizationHeader.mockRejectedValueOnce(new AuthenticationRequiredError());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitAnalysisRequest("/api/analyze", {}, "key")).resolves.toEqual({
      kind: "auth_required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a network error when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("offline");
    }));

    await expect(submitAnalysisRequest("/api/analyze", {}, "key")).resolves.toEqual({
      kind: "network_error",
    });
  });
});
