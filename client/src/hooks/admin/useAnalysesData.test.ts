import { describe, expect, it } from "vitest";

import { normalizeAnalysisRow } from "./useAnalysesData";

describe("normalizeAnalysisRow", () => {
  it("keeps project fields when Supabase embeds relations as arrays", () => {
    const row = normalizeAnalysisRow({
      id: "analysis-1",
      status: "SUCCESS",
      error_code: null,
      model_name: "gemini-2.5-flash-lite",
      model_provider: "gemini",
      response_time_ms: 1234,
      total_chars: 2500,
      created_at: "2026-07-13T00:00:00.000Z",
      users: [{ email: "user@example.com", name: "사용자" }],
      projects: [
        {
          title: "현대자동차 PM 지원서",
          company: "현대자동차",
          job_keyword: "서비스 기획",
        },
      ],
      token_usages: [{ total_tokens: 1200, cost: 0.01 }],
    });

    expect(row.project_title).toBe("현대자동차 PM 지원서");
    expect(row.project_company).toBe("현대자동차");
    expect(row.project_job_keyword).toBe("서비스 기획");
    expect(row.user_email).toBe("user@example.com");
  });
});
