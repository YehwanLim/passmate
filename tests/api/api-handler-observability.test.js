import { describe, expect, it, vi } from "vitest";

import { withApiHandler } from "../../lib/api-handler.js";

function response() {
  return {
    body: undefined,
    headers: {},
    statusCode: null,
    json(body) {
      this.body = body;
      return body;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

describe("withApiHandler unexpected failures", () => {
  it("writes safe diagnostics while returning an opaque error", async () => {
    const secretMessage = "resume text and provider secret must never be logged";
    const failure = new Error(secretMessage);
    failure.code = "P2021";
    failure.meta = { code: "42P01", message: secretMessage };
    failure.safeDiagnosticStage = "rate_limit_bucket";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = response();

    try {
      await withApiHandler({ headers: {} }, res, async () => {
        throw failure;
      });

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "INTERNAL_ERROR", requestId: expect.any(String) });
      expect(errorLog).toHaveBeenCalledWith("[api] unexpected request failure", {
        code: "P2021",
        databaseCode: "42P01",
        requestId: expect.any(String),
        stage: "rate_limit_bucket",
        statusCode: 500,
      });
      expect(JSON.stringify(errorLog.mock.calls)).not.toContain(secretMessage);
    } finally {
      errorLog.mockRestore();
    }
  });
});
