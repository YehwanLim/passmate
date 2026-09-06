import { describe, expect, it, vi } from "vitest";

import {
  analyzeCompany,
  buildCompanyProjectTitle,
  buildCompanyUserPrompt,
  companyAnalysisInput,
  companyRequestHash,
  COMPANY_RESEARCH_MODEL,
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

const REPORT = {
  brief: { oneLiner: "전동화로 체급을 바꾸는 완성차", keywords: ["전동화"], asOf: "", positionInIndustry: "국내 1위" },
  businessMap: { summary: "", segments: [], customersAndCompetitors: "" },
  focusBusinesses: { statedDirection: "", items: [], translatedTalentKeywords: [] },
  financialSnapshot: { listed: true, market: "유가증권시장", revenueTrend: "", profitTrend: "", keyFigures: [], marketView: "", recentDisclosures: [], fundingNote: "", forApplicant: "" },
  currentIssues: [],
  roleInContext: { whereItSits: "", problemsItSolves: [], whyHiringNow: "", recentNewsForRole: [], postingReading: "" },
  opportunitiesAndRisks: { opportunities: [], risks: [] },
  businessCandidates: [],
  interviewPrep: { questions: [], primarySources: [] },
};

function geminiResponse({ text, parts, grounding = true, usage = { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 } }) {
  return new Response(JSON.stringify({
    candidates: [{
      content: { parts: parts ?? [{ text }] },
      groundingMetadata: grounding
        ? {
          webSearchQueries: ["현대자동차 전략기획"],
          searchEntryPoint: { renderedContent: "<div>chips</div>" },
          groundingChunks: [{ web: { uri: "https://redirect/1", title: "hyundai.com" } }],
        }
        : undefined,
    }],
    usageMetadata: usage,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function recordingFetcher(responses) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), signal: init.signal });
    const next = responses.shift();
    if (typeof next === "function") return next();
    return next;
  };
  return { calls, fetcher };
}

const request = { company: "현대자동차", jobKeyword: "전략기획", postingText: "", resumeAnalysisId: null };
const db = { aiModelSetting: { findUnique: async () => null } };

describe("buildCompanyUserPrompt", () => {
  it("names the company, role, as-of date, and the five research topics", () => {
    const prompt = buildCompanyUserPrompt({ ...request, postingText: "수행직무: 시장 모니터링" }, "2026-09-06");
    expect(prompt).toContain("[기업]: 현대자동차");
    expect(prompt).toContain("[직무]: 전략기획");
    expect(prompt).toContain("[기준일]: 2026-09-06");
    expect(prompt).toContain("[채용공고]");
    expect(prompt).toContain("수행직무: 시장 모니터링");
    for (const topic of ["사업부문", "주력 사업", "실적", "공시", "직무", "이슈"]) {
      expect(prompt).toContain(topic);
    }
    expect(buildCompanyUserPrompt(request, "2026-09-06")).not.toContain("[채용공고]");
  });
});

describe("analyzeCompany", () => {
  it("returns the grounded report with sources, meta, and usage after one call", async () => {
    const { calls, fetcher } = recordingFetcher([
      geminiResponse({ parts: [{ text: "```json\n" + JSON.stringify(REPORT).slice(0, 40) }, { text: JSON.stringify(REPORT).slice(40) + "\n```" }] }),
    ]);

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(`/models/${COMPANY_RESEARCH_MODEL}:generateContent`);
    expect(calls[0].body.tools).toEqual([{ google_search: {} }]);
    expect(calls[0].body.generationConfig.responseMimeType).toBeUndefined();
    expect(result.brief.asOf).toBe("2026-09-06");
    expect(result.sources).toEqual([{ id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "hyundai.com" }]);
    expect(result.reportMeta).toEqual({
      kind: "COMPANY",
      schemaVersion: 1,
      asOf: "2026-09-06",
      searchQueries: ["현대자동차 전략기획"],
      searchEntryPointHtml: "<div>chips</div>",
      linkedResumeAnalysisId: null,
      repaired: false,
    });
    expect(result.analysisMeta).toMatchObject({
      modelProvider: "gemini",
      modelName: COMPANY_RESEARCH_MODEL,
      httpStatus: 200,
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
  });

  it("repairs unparseable research output with one JSON-mode call and keeps the research sources", async () => {
    const { calls, fetcher } = recordingFetcher([
      geminiResponse({ text: "조사 메모: 전동화 투자 확대, 매출 성장..." }),
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false, usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }),
    ]);

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06" });

    expect(calls).toHaveLength(2);
    expect(calls[1].url).toContain("/models/gemini-2.5-flash-lite:generateContent");
    expect(calls[1].body.tools).toBeUndefined();
    expect(calls[1].body.generationConfig.responseMimeType).toBe("application/json");
    expect(calls[1].body.contents[0].parts[0].text).toContain("조사 메모: 전동화 투자 확대");
    expect(result.sources).toHaveLength(1);
    expect(result.reportMeta.repaired).toBe(true);
    expect(result.analysisMeta.tokenUsage).toEqual({ promptTokens: 110, completionTokens: 55, totalTokens: 165 });
  });

  it("fails with PARSE_ERROR when the repair call also returns no JSON", async () => {
    const { fetcher } = recordingFetcher([
      geminiResponse({ text: "메모만" }),
      geminiResponse({ text: "여전히 메모", grounding: false }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });

  it("skips the repair call when less than the minimum budget remains", async () => {
    let clock = 0;
    const now = () => clock;
    const { calls, fetcher } = recordingFetcher([
      () => { clock += 80_000; return geminiResponse({ text: "메모만" }); },
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", now })).rejects.toMatchObject({ code: "PARSE_ERROR" });
    expect(calls).toHaveLength(1);
  });

  it("passes CONTEXT_IRRELEVANT through for the lifecycle to classify", async () => {
    const { fetcher } = recordingFetcher([
      geminiResponse({ text: '{"error":"CONTEXT_IRRELEVANT","message":"확인할 수 있는 기업이 아닙니다."}' }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key" })).resolves.toMatchObject({ error: "CONTEXT_IRRELEVANT" });
  });

  it("surfaces provider HTTP failures with their status code", async () => {
    const { fetcher } = recordingFetcher([new Response("overloaded", { status: 503 })]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key" })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("refuses to call the provider without an API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      const { calls, fetcher } = recordingFetcher([]);
      await expect(analyzeCompany(request, db, { fetcher })).rejects.toMatchObject({ code: "API_ERROR" });
      expect(calls).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("carries the linked résumé analysis id into reportMeta", async () => {
    const { fetcher } = recordingFetcher([geminiResponse({ text: JSON.stringify(REPORT) })]);
    const result = await analyzeCompany({ ...request, resumeAnalysisId: RESUME_ANALYSIS_ID }, db, { fetcher, apiKey: "test-key" });
    expect(result.reportMeta.linkedResumeAnalysisId).toBe(RESUME_ANALYSIS_ID);
  });
});
