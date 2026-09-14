import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizationHeader: vi.fn(),
}));

vi.mock("@/lib/apiAuth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/apiAuth")>()),
  getAuthorizationHeader: mocks.getAuthorizationHeader,
}));

import { AuthenticationRequiredError } from "@/lib/apiAuth";
import {
  MAX_POSTING_URL_CHARS,
  getJobPostingErrorMessage,
  isValidPostingUrl,
  requestJobPosting,
} from "./jobPosting";

const SUMMARY = {
  title: "백엔드 개발자",
  company: "프리뷰",
  role: "백엔드",
  responsibilities: ["API 설계"],
  requirements: ["Node.js 3년"],
  preferred: ["Postgres"],
  keywords: ["Node.js", "Postgres"],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("requestJobPosting", () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal("fetch", fetchSpy);
    mocks.getAuthorizationHeader.mockReset();
    mocks.getAuthorizationHeader.mockResolvedValue({ Authorization: "Bearer t" });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the input with the auth header and maps a 200 into a record", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, {
        job_posting_id: "jp_1",
        source_url: "https://careers.example.com/1",
        summary: SUMMARY,
        char_count: 1234,
      })
    );

    const result = await requestJobPosting({ url: "https://careers.example.com/1" });

    expect(fetchSpy).toHaveBeenCalledWith("/api/analyze/posting", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
      body: JSON.stringify({ url: "https://careers.example.com/1" }),
    });
    expect(result).toEqual({
      kind: "accepted",
      record: {
        id: "jp_1",
        sourceUrl: "https://careers.example.com/1",
        summary: SUMMARY,
        charCount: 1234,
      },
    });
  });

  it("keeps sourceUrl null for pasted text", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse(200, { job_posting_id: "jp_2", source_url: null, summary: SUMMARY, char_count: 300 })
    );
    const result = await requestJobPosting({ text: "공고 본문".repeat(50) });
    expect(result.kind).toBe("accepted");
    if (result.kind === "accepted") expect(result.record.sourceUrl).toBeNull();
  });

  it("maps error bodies to rejected with the server code", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(422, { error: "POSTING_URL_UNREADABLE" }));
    expect(await requestJobPosting({ url: "https://x.y" })).toEqual({
      kind: "rejected",
      code: "POSTING_URL_UNREADABLE",
      status: 422,
    });
  });

  it("returns an empty code when the error body is missing", async () => {
    fetchSpy.mockResolvedValue(new Response("", { status: 502 }));
    expect(await requestJobPosting({ url: "https://x.y" })).toEqual({
      kind: "rejected",
      code: "",
      status: 502,
    });
  });

  it("maps 401 to auth_required", async () => {
    fetchSpy.mockResolvedValue(jsonResponse(401, { error: "AUTH_REQUIRED" }));
    expect(await requestJobPosting({ url: "https://x.y" })).toEqual({ kind: "auth_required" });
  });

  it("maps a missing session to auth_required without calling fetch", async () => {
    mocks.getAuthorizationHeader.mockRejectedValue(new AuthenticationRequiredError());
    expect(await requestJobPosting({ url: "https://x.y" })).toEqual({ kind: "auth_required" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("maps a thrown fetch to network_error", async () => {
    fetchSpy.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await requestJobPosting({ url: "https://x.y" })).toEqual({ kind: "network_error" });
  });
});

describe("isValidPostingUrl", () => {
  it("accepts http/https within the length limit", () => {
    expect(isValidPostingUrl("https://www.wanted.co.kr/wd/1")).toBe(true);
    expect(isValidPostingUrl("  http://example.com/job  ")).toBe(true);
  });

  it("rejects other schemes, plain text, empty, and overlong values", () => {
    expect(isValidPostingUrl("")).toBe(false);
    expect(isValidPostingUrl("ftp://example.com")).toBe(false);
    expect(isValidPostingUrl("javascript:alert(1)")).toBe(false);
    expect(isValidPostingUrl("채용공고")).toBe(false);
    expect(isValidPostingUrl(`https://a.b/${"x".repeat(MAX_POSTING_URL_CHARS)}`)).toBe(false);
  });
});

describe("getJobPostingErrorMessage", () => {
  it("returns Korean copy per code and a fallback", () => {
    expect(getJobPostingErrorMessage("POSTING_URL_UNREADABLE")).toContain("텍스트로 붙여");
    expect(getJobPostingErrorMessage("POSTING_NOT_RECOGNIZED")).toContain("채용공고로 보이지");
    expect(getJobPostingErrorMessage("POSTING_EXTRACT_FAILED")).toContain("정리하지 못했어요");
    expect(getJobPostingErrorMessage("RATE_LIMITED")).toContain("15분");
    expect(getJobPostingErrorMessage("INVALID_REQUEST")).toContain("확인해 주세요");
    expect(getJobPostingErrorMessage("", 429)).toContain("15분");
    expect(getJobPostingErrorMessage("SOMETHING_ELSE")).toBe(
      "공고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."
    );
  });
});
