import { describe, expect, it } from "vitest";

import { getAnalyzeApiErrorResponse } from "../../api/analyze.js";

describe("analyze API error response", () => {
  it("maps Google high-demand 503 errors to a friendly retryable response", () => {
    const error = new Error(
      'Google API Error 503: { "error": { "code": 503, "message": "This model is currently experiencing high demand.", "status": "UNAVAILABLE" } }',
    );
    error.statusCode = 503;

    expect(getAnalyzeApiErrorResponse(error)).toEqual({
      body: {
        error: "MODEL_OVERLOADED",
        message: "AI 모델 사용량이 잠시 몰렸어요. 작성하신 내용은 안전하게 보관 중이니 잠시 후 다시 시도해 주세요.",
      },
      status: 503,
    });
  });
});
