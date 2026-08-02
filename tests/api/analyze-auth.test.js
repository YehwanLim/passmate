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
    expect(response.body).toEqual({ error: "Unauthorized" });
    expect(response.headers["Access-Control-Allow-Headers"]).toContain("Authorization");
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
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("converts authentication configuration failures into an API error response", async () => {
    const response = createResponse();

    await analyzeHandler(
      {
        body: { questions: [{ question: "문항", answer: "가".repeat(200) }] },
        headers: { authorization: "Bearer test-token" },
        method: "POST",
      },
      response,
    );

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toContain("SUPABASE_URL");
  });
});
