import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiAuth", () => ({
  getAuthorizationHeader: async () => ({ Authorization: "Bearer test-token" }),
}));

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

  it("reports a network error when the request itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new TypeError("offline");
    }));

    await expect(submitAnalysisRequest("/api/analyze", {}, "key")).resolves.toEqual({
      kind: "network_error",
    });
  });
});
