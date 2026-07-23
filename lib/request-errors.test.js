import { afterEach, describe, expect, it, vi } from "vitest";

import { handleRequestError } from "./request-errors.js";

function response() {
  return {
    body: undefined,
    statusCode: null,
    json(body) {
      this.body = body;
      return body;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("request error diagnostics", () => {
  it("logs only route, request ID, status, and a stable error code", () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("applicant@example.test supplied a cover letter"), {
      code: "API_ERROR",
      statusCode: 502,
      rawProviderResponse: { prompt: "private response content" },
    });
    const res = response();

    handleRequestError(res, error, "request-123", "/api/protected");

    expect(logger).toHaveBeenCalledWith("[/api/protected] request failed", {
      code: "API_ERROR",
      requestId: "request-123",
      statusCode: 502,
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("applicant@example.test");
    expect(res.body).toEqual({ error: "Request failed", requestId: "request-123" });
  });
});
