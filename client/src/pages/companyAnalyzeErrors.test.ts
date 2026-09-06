import { describe, expect, it } from "vitest";

import { getCompanyAnalyzeError } from "./companyAnalyzeErrors";

describe("getCompanyAnalyzeError", () => {
  it("maps the company-specific codes to Korean copy and actions", () => {
    expect(getCompanyAnalyzeError({ error: "COMPANY_CREDITS_EXHAUSTED" }, 409)).toEqual({
      title: "이용권 없음",
      message: "기업 분석 이용권이 없어요. 판매가 열리면 이용권 페이지에서 구매할 수 있어요.",
      actionLabel: "이용권 확인하기",
      actionHref: "/entitlements",
      trackingType: "credits_exhausted",
    });
    expect(getCompanyAnalyzeError({ error: "COMPANY_ANALYSIS_DISABLED" }, 503)).toMatchObject({
      title: "준비 중",
      trackingType: "disabled",
    });
    expect(getCompanyAnalyzeError({ error: "RESUME_ANALYSIS_NOT_FOUND" }, 404)).toMatchObject({
      title: "연결 오류",
      trackingType: "resume_not_found",
    });
  });

  it("falls back to the shared analyze copy for shared codes and never leaks raw server text", () => {
    const rateLimited = getCompanyAnalyzeError({ error: "RATE_LIMITED", message: "raw provider text" }, 429);
    expect(rateLimited.title).toBe("요청 제한");
    expect(rateLimited.trackingType).toBe("rate_limit");
    expect(JSON.stringify(rateLimited)).not.toContain("raw provider text");

    const irrelevant = getCompanyAnalyzeError({ error: "CONTEXT_IRRELEVANT" }, 400);
    expect(irrelevant.trackingType).toBe("context_irrelevant");

    const unknown = getCompanyAnalyzeError({ error: "SOMETHING_ELSE", message: "secret" }, 500);
    expect(unknown.trackingType).toBe("server_error");
    expect(JSON.stringify(unknown)).not.toContain("secret");
  });
});
