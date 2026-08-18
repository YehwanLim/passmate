import { describe, expect, it } from "vitest";
import analyzeHandler from "../../api/analyze.js";

function createResponse() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    end() {},
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
  };
}

describe("analyze API authentication", () => {
  it("rejects an unauthenticated request before analysis input is processed", async () => {
    const response = createResponse();

    await analyzeHandler(
      {
        body: { questions: [{ question: "문항", answer: "가".repeat(200) }] },
        headers: {},
        method: "POST",
      },
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error: "AUTHENTICATION_REQUIRED",
      requestId: expect.any(String),
    });
    expect(response.headers["Access-Control-Allow-Headers"]).toBeUndefined();
  });

  it("rejects malformed unauthenticated bodies before parsing them", async () => {
    const response = createResponse();

    await analyzeHandler(
      {
        body: "{malformed-json",
        headers: {},
        method: "POST",
      },
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      error: "AUTHENTICATION_REQUIRED",
      requestId: expect.any(String),
    });
  });

  it("converts authentication configuration failures into an API error response", async () => {
    const response = createResponse();
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      await analyzeHandler(
        {
          body: { questions: [{ question: "문항", answer: "가".repeat(200) }] },
          headers: { authorization: "Bearer test-token" },
          method: "POST",
        },
        response,
      );

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({
        error: "INTERNAL_ERROR",
        requestId: expect.any(String),
      });
    } finally {
      if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = originalSupabaseUrl;

      if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });
});
