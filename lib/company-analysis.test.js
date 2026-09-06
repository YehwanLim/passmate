import { describe, expect, it } from "vitest";

import {
  buildCompanyProjectTitle,
  companyAnalysisInput,
  companyRequestHash,
  extractGroundingMeta,
  extractGroundingSources,
  joinCandidateText,
  normalizeCompanyRequest,
  parseModelJsonTolerant,
} from "./company-analysis.js";
import { COMPANY_ANALYSIS_THROUGHPUT, getCompanyAnalysisThroughputPolicy } from "./rate-limit.js";

const RESUME_ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("normalizeCompanyRequest", () => {
  it("accepts company and job keyword with optional posting text and résumé link", () => {
    expect(normalizeCompanyRequest({
      company: " 현대자동차 ",
      jobKeyword: "전략기획",
      postingText: "<b>수행직무</b> 시장 모니터링",
      resumeAnalysisId: RESUME_ANALYSIS_ID,
    })).toEqual({
      company: "현대자동차",
      jobKeyword: "전략기획",
      postingText: "수행직무 시장 모니터링",
      resumeAnalysisId: RESUME_ANALYSIS_ID,
    });
  });

  it("defaults optional fields when absent", () => {
    expect(normalizeCompanyRequest({ company: "카카오", jobKeyword: "서비스 기획" })).toEqual({
      company: "카카오",
      jobKeyword: "서비스 기획",
      postingText: "",
      resumeAnalysisId: null,
    });
  });

  it.each([
    [null],
    [{ company: "카카오" }],
    [{ company: "", jobKeyword: "기획" }],
    [{ company: "카카오", jobKeyword: "기획", questions: [] }],
    [{ company: "카".repeat(101), jobKeyword: "기획" }],
    [{ company: "카카오", jobKeyword: "기획", postingText: "가".repeat(4001) }],
    [{ company: "카카오", jobKeyword: "기획", resumeAnalysisId: "not-a-uuid" }],
  ])("rejects %j with INVALID_REQUEST", (body) => {
    expect(() => normalizeCompanyRequest(body)).toThrow(expect.objectContaining({
      code: "INVALID_REQUEST",
      statusCode: 400,
    }));
  });
});

describe("request hash, title, and stored input", () => {
  it("hashes the company request with a kind marker so it never collides with a résumé request", () => {
    const request = normalizeCompanyRequest({ company: "카카오", jobKeyword: "기획" });
    const hash = companyRequestHash(request);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(companyRequestHash({ ...request, jobKeyword: "마케팅" }));
  });

  it("builds the project title and the empty analysis input", () => {
    expect(buildCompanyProjectTitle("카카오", "기획")).toBe("카카오 기획 기업 분석");
    expect(companyAnalysisInput()).toEqual({ questionText: "", inputText: "", totalChars: null });
  });
});

describe("throughput policy", () => {
  it("uses a company-specific rate limit route and concurrency of 2", () => {
    expect(getCompanyAnalysisThroughputPolicy()).toBe(COMPANY_ANALYSIS_THROUGHPUT);
    expect(COMPANY_ANALYSIS_THROUGHPUT).toEqual({
      concurrencyLimit: 2,
      rateLimit: { route: "company-analysis", limit: 5, windowMs: 15 * 60 * 1000 },
    });
  });
});

describe("model output parsing", () => {
  it("joins every text part of the first candidate", () => {
    expect(joinCandidateText({
      candidates: [{ content: { parts: [{ text: "{\"a\":" }, { text: "1}" }, { inlineData: {} }] } }],
    })).toBe('{"a":1}');
  });

  it("parses JSON wrapped in fences or surrounded by prose", () => {
    expect(parseModelJsonTolerant('```json\n{"brief":{"oneLiner":"x"}}\n```')).toEqual({ brief: { oneLiner: "x" } });
    expect(parseModelJsonTolerant('검색 결과를 정리했습니다.\n{"brief":{"oneLiner":"x"}}\n끝.')).toEqual({ brief: { oneLiner: "x" } });
  });

  it("throws PARSE_ERROR when no JSON object can be recovered", () => {
    expect(() => parseModelJsonTolerant("no json here")).toThrow(expect.objectContaining({ code: "PARSE_ERROR" }));
    expect(() => parseModelJsonTolerant('{"broken":')).toThrow(expect.objectContaining({ code: "PARSE_ERROR" }));
  });
});

describe("grounding metadata", () => {
  const data = {
    candidates: [{
      groundingMetadata: {
        webSearchQueries: ["현대자동차 2026 실적", "현대자동차 전략기획"],
        searchEntryPoint: { renderedContent: "<div>chips</div>" },
        groundingChunks: [
          { web: { uri: "https://redirect/1", title: "hyundai.com" } },
          { web: { uri: "https://redirect/2", title: "dart.fss.or.kr" } },
          { web: { uri: "https://redirect/1", title: "hyundai.com" } },
          { retrievedContext: { uri: "ignored" } },
        ],
      },
    }],
  };

  it("numbers unique web sources from 1 and drops non-web chunks", () => {
    expect(extractGroundingSources(data)).toEqual([
      { id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "hyundai.com" },
      { id: 2, title: "dart.fss.or.kr", url: "https://redirect/2", publisher: "dart.fss.or.kr" },
    ]);
  });

  it("caps sources at 12", () => {
    const many = {
      candidates: [{
        groundingMetadata: {
          groundingChunks: Array.from({ length: 20 }, (_, index) => ({
            web: { uri: `https://redirect/${index}`, title: `site-${index}` },
          })),
        },
      }],
    };
    expect(extractGroundingSources(many)).toHaveLength(12);
  });

  it("reads search queries and the search entry point, tolerating their absence", () => {
    expect(extractGroundingMeta(data)).toEqual({
      searchQueries: ["현대자동차 2026 실적", "현대자동차 전략기획"],
      searchEntryPointHtml: "<div>chips</div>",
    });
    expect(extractGroundingMeta({ candidates: [{}] })).toEqual({ searchQueries: [], searchEntryPointHtml: null });
  });
});
