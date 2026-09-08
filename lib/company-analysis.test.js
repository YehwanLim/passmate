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
  tidyCompanyReport,
  buildCompanyResearchPrompt,
  COMPANY_COMPOSE_MODEL,
  COMPANY_DEFAULT_PIPELINE,
  COMPANY_RESEARCH_TOPIC_GROUPS,
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
      { id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "redirect" },
      { id: 2, title: "dart.fss.or.kr", url: "https://redirect/2", publisher: "redirect" },
    ]);
  });

  it("caps sources at 20", () => {
    const many = {
      candidates: [{
        groundingMetadata: {
          groundingChunks: Array.from({ length: 30 }, (_, index) => ({
            web: { uri: `https://redirect/${index}`, title: `site-${index}` },
          })),
        },
      }],
    };
    expect(extractGroundingSources(many)).toHaveLength(20);
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
  const custom = typeof grounding === "object" && grounding !== null ? grounding : null;
  return new Response(JSON.stringify({
    candidates: [{
      content: { parts: parts ?? [{ text }] },
      groundingMetadata: grounding
        ? {
          webSearchQueries: custom?.queries ?? ["현대자동차 전략기획"],
          searchEntryPoint: { renderedContent: custom?.entryPoint ?? "<div>chips</div>" },
          groundingChunks: custom?.chunks ?? [{ web: { uri: "https://redirect/1", title: "hyundai.com" } }],
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

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06", pipeline: "single" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(`/models/${COMPANY_RESEARCH_MODEL}:generateContent`);
    expect(calls[0].body.tools).toEqual([{ google_search: {} }]);
    expect(calls[0].body.generationConfig.responseMimeType).toBeUndefined();
    expect(result.brief.asOf).toBe("2026-09-06");
    expect(result.sources).toEqual([{ id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "redirect" }]);
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

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06", pipeline: "single" });

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

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", pipeline: "single" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });

  it("skips the repair call when less than the minimum budget remains", async () => {
    let clock = 0;
    const now = () => clock;
    const { calls, fetcher } = recordingFetcher([
      () => { clock += 80_000; return geminiResponse({ text: "메모만" }); },
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", now, pipeline: "single" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
    expect(calls).toHaveLength(1);
  });

  it("passes CONTEXT_IRRELEVANT through for the lifecycle to classify", async () => {
    const { fetcher } = recordingFetcher([
      geminiResponse({ text: '{"error":"CONTEXT_IRRELEVANT","message":"확인할 수 있는 기업이 아닙니다."}' }),
    ]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", pipeline: "single" })).resolves.toMatchObject({ error: "CONTEXT_IRRELEVANT" });
  });

  it("surfaces provider HTTP failures with their status code", async () => {
    const { fetcher } = recordingFetcher([new Response("overloaded", { status: 503 })]);

    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", pipeline: "single" })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("refuses to call the provider without an API key", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      const { calls, fetcher } = recordingFetcher([]);
      await expect(analyzeCompany(request, db, { fetcher, pipeline: "single" })).rejects.toMatchObject({ code: "API_ERROR" });
      expect(calls).toHaveLength(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("carries the linked résumé analysis id into reportMeta", async () => {
    const { fetcher } = recordingFetcher([geminiResponse({ text: JSON.stringify(REPORT) })]);
    const result = await analyzeCompany({ ...request, resumeAnalysisId: RESUME_ANALYSIS_ID }, db, { fetcher, apiKey: "test-key", pipeline: "single" });
    expect(result.reportMeta.linkedResumeAnalysisId).toBe(RESUME_ANALYSIS_ID);
  });
});

describe("tidyCompanyReport", () => {
  const asOf = "2026-09-07";

  it("drops issues and role news dated more than 12 months before the as-of date", () => {
    const tidied = tidyCompanyReport({
      ...REPORT,
      currentIssues: [
        { title: "최근", when: "2026-07", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] },
        { title: "경계", when: "2025-09", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] },
        { title: "오래됨", when: "2025-08", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] },
        { title: "연도만", when: "2024", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] },
        { title: "형식 불명", when: "지난해", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] },
      ],
      roleInContext: {
        ...REPORT.roleInContext,
        recentNewsForRole: [
          { title: "오래된 소식", when: "2025-01", fact: "", whyForRole: "", sourceIds: [] },
          { title: "최신 소식", when: "2026-09", fact: "", whyForRole: "", sourceIds: [] },
        ],
      },
    }, asOf);

    expect(tidied.currentIssues.map((issue) => issue.title)).toEqual(["최근", "경계", "형식 불명"]);
    expect(tidied.roleInContext.recentNewsForRole.map((news) => news.title)).toEqual(["최신 소식"]);
  });

  it("keeps the original list when the date filter would empty it", () => {
    const stale = [{ title: "오래된 소식", when: "2025-01", fact: "", whyForRole: "", sourceIds: [] }];
    const tidied = tidyCompanyReport({
      ...REPORT,
      roleInContext: { ...REPORT.roleInContext, recentNewsForRole: stale },
    }, asOf);
    expect(tidied.roleInContext.recentNewsForRole).toEqual(stale);
  });

  it("caps keywords at 6 and key figures at 4, and strips the period repeated inside a figure label", () => {
    const tidied = tidyCompanyReport({
      ...REPORT,
      brief: { ...REPORT.brief, keywords: ["1", "2", "3", "4", "5", "6", "7"] },
      financialSnapshot: {
        ...REPORT.financialSnapshot,
        keyFigures: [
          { label: "2026년 2분기 매출", value: "171조 원", period: "2026년 2분기", sourceIds: [1] },
          { label: "영업이익 (2026년 1분기)", value: "57조 원", period: "2026년 1분기", sourceIds: [2] },
          { label: "영업이익률", value: "52%", period: "2026년 2분기", sourceIds: [3] },
          { label: "매출", value: "300조 원", period: "2025년 연간", sourceIds: [4] },
          { label: "다섯 번째", value: "1", period: "2025년 연간", sourceIds: [5] },
        ],
      },
    }, asOf);

    expect(tidied.brief.keywords).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(tidied.financialSnapshot.keyFigures.map((figure) => figure.label)).toEqual(["매출", "영업이익", "영업이익률", "매출"]);
    expect(tidied.financialSnapshot.keyFigures[0]).toMatchObject({ value: "171조 원", period: "2026년 2분기", sourceIds: [1] });
  });

  it("leaves a figure label alone when stripping the period would empty it", () => {
    const tidied = tidyCompanyReport({
      ...REPORT,
      financialSnapshot: {
        ...REPORT.financialSnapshot,
        keyFigures: [{ label: "2025년 연간", value: "1", period: "2025년 연간", sourceIds: [] }],
      },
    }, asOf);
    expect(tidied.financialSnapshot.keyFigures[0].label).toBe("2025년 연간");
  });

  it("drops primary sources whose url is not an http(s) address", () => {
    const tidied = tidyCompanyReport({
      ...REPORT,
      interviewPrep: {
        questions: [],
        primarySources: [
          { label: "뉴스룸", url: "https://news.samsung.com/kr/" },
          { label: "반기보고서", url: "확인하지 못함" },
          { label: "홈페이지", url: "www.samsung.com" },
          { label: "자바스크립트", url: "javascript:alert(1)" },
        ],
      },
    }, asOf);
    expect(tidied.interviewPrep.primarySources).toEqual([{ label: "뉴스룸", url: "https://news.samsung.com/kr/" }]);
  });

  it("tolerates missing or malformed sections without throwing", () => {
    expect(() => tidyCompanyReport({ brief: {} }, asOf)).not.toThrow();
    expect(tidyCompanyReport({ brief: { keywords: "반도체" }, financialSnapshot: { keyFigures: null } }, asOf)).toMatchObject({
      brief: { keywords: "반도체" },
      financialSnapshot: { keyFigures: null },
    });
  });
});

describe("analyzeCompany applies tidyCompanyReport", () => {
  it("removes stale issues from the research output before returning", async () => {
    const stale = { title: "오래됨", when: "2024-01", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] };
    const fresh = { title: "최근", when: "2026-08", fact: "", whyItMatters: "", forApplicant: "", sourceIds: [] };
    const { fetcher } = recordingFetcher([geminiResponse({ text: JSON.stringify({ ...REPORT, currentIssues: [stale, fresh] }) })]);

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-06", pipeline: "single" });

    expect(result.currentIssues).toEqual([fresh]);
  });
});

describe("buildCompanyResearchPrompt", () => {
  it("asks for a fact memo on six topics, scoped to the input company, without writing the report", () => {
    const prompt = buildCompanyResearchPrompt({ ...request, postingText: "수행직무: 시장 모니터링" }, "2026-09-08");
    expect(prompt).toContain("[기업]: 현대자동차");
    expect(prompt).toContain("[직무]: 전략기획");
    expect(prompt).toContain("[기준일]: 2026-09-08");
    expect(prompt).toContain("수행직무: 시장 모니터링");
    for (const topic of ["사업부문", "신사업", "실적", "인재상", "계열사", "공채 일정"]) {
      expect(prompt).toContain(topic);
    }
    expect(prompt).toContain("리포트를 쓰지");
    expect(prompt).toContain("최소 2회");
    expect(prompt).toContain("의혹");
    expect(prompt).toContain("인재상\"");
    expect(buildCompanyResearchPrompt(request, "2026-09-08")).not.toContain("[채용공고]");
  });

  it("can be limited to a subset of topics for the parallel research split", () => {
    const business = buildCompanyResearchPrompt(request, "2026-09-08", COMPANY_RESEARCH_TOPIC_GROUPS.business);
    const role = buildCompanyResearchPrompt(request, "2026-09-08", COMPANY_RESEARCH_TOPIC_GROUPS.role);
    expect(business).toContain("1) 사업부문");
    expect(business).toContain("3) 최근 2~3년 실적");
    expect(business).not.toContain("6) 회사가 공식적으로");
    expect(role).toContain("4) 지원 직무");
    expect(role).toContain("6) 회사가 공식적으로");
    expect(role).toContain("7) 지원자가 더 읽을 1차 자료");
    expect(role).not.toContain("1) 사업부문");
    expect(role).toContain("네 주제 각각");
  });
});

describe("analyzeCompany two-stage pipeline", () => {
  const memo = "- (2026-07) 전동화 투자 확대 — hyundai.com\n- (2026-04) 매출 성장 — dart.fss.or.kr";

  const roleMemo = "- (2026-06) 기획팀 개편 — hyundai.com\n- 인재상: 확인하지 못함";

  it("runs two research calls in parallel, then composes JSON without tools from both memos, merging the sources", async () => {
    const { calls, fetcher } = recordingFetcher([
      geminiResponse({ text: memo }),
      geminiResponse({
        text: roleMemo,
        grounding: { queries: ["현대자동차 인재상"], chunks: [{ web: { uri: "https://redirect/1", title: "hyundai.com" } }, { web: { uri: "https://redirect/2", title: "dart.fss.or.kr" } }] },
      }),
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false, usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } }),
    ]);

    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", asOf: "2026-09-08", pipeline: "two-stage" });

    expect(calls).toHaveLength(3);
    for (const call of calls.slice(0, 2)) {
      expect(call.url).toContain(`/models/${COMPANY_RESEARCH_MODEL}:generateContent`);
      expect(call.body.tools).toEqual([{ google_search: {} }]);
      expect(call.body.generationConfig.responseMimeType).toBeUndefined();
      expect(call.body.contents[0].parts[0].text).toContain("리포트를 쓰지");
      expect(call.body.contents[0].parts[0].text).not.toContain("# [출력: JSON만");
    }
    expect(calls[0].body.contents[0].parts[0].text).toContain("1) 사업부문");
    expect(calls[0].body.contents[0].parts[0].text).not.toContain("6) 회사가 공식적으로");
    expect(calls[1].body.contents[0].parts[0].text).toContain("6) 회사가 공식적으로");
    expect(calls[1].body.contents[0].parts[0].text).not.toContain("1) 사업부문");

    expect(calls[2].url).toContain(`/models/${COMPANY_COMPOSE_MODEL}:generateContent`);
    expect(calls[2].body.tools).toBeUndefined();
    expect(calls[2].body.generationConfig.responseMimeType).toBe("application/json");
    const composeText = calls[2].body.contents[0].parts[0].text;
    expect(composeText).toContain("# [출력: JSON만");
    expect(composeText).toContain(memo);
    expect(composeText).toContain(roleMemo);
    expect(composeText).toContain("[계열사 이름]");
    expect(composeText).toContain("recentDisclosures 에 넣지 않습니다");

    expect(result.brief.asOf).toBe("2026-09-08");
    expect(result.sources).toEqual([
      { id: 1, title: "hyundai.com", url: "https://redirect/1", publisher: "redirect" },
      { id: 2, title: "dart.fss.or.kr", url: "https://redirect/2", publisher: "redirect" },
    ]);
    expect(result.reportMeta).toMatchObject({ kind: "COMPANY", searchQueries: ["현대자동차 전략기획", "현대자동차 인재상"], searchEntryPointHtml: "<div>chips</div>", repaired: false });
    expect(result.analysisMeta).toMatchObject({
      pipeline: "two-stage",
      modelName: `${COMPANY_RESEARCH_MODEL}+${COMPANY_COMPOSE_MODEL}`,
      tokenUsage: { promptTokens: 210, completionTokens: 105, totalTokens: 315 },
    });
    expect(result.analysisMeta.stages.map((stage) => stage.name)).toEqual(["research-business", "research-role", "compose"]);
  });

  it("fails with PARSE_ERROR when both research memos are empty, without calling compose", async () => {
    const { calls, fetcher } = recordingFetcher([geminiResponse({ text: "   " }), geminiResponse({ text: "" })]);
    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", pipeline: "two-stage" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
    expect(calls).toHaveLength(2);
  });

  it("still composes when only one research memo came back", async () => {
    const { calls, fetcher } = recordingFetcher([
      geminiResponse({ text: "" }),
      geminiResponse({ text: roleMemo }),
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false }),
    ]);
    const result = await analyzeCompany(request, db, { fetcher, apiKey: "test-key", pipeline: "two-stage" });
    expect(calls).toHaveLength(3);
    expect(calls[2].body.contents[0].parts[0].text).toContain(roleMemo);
    expect(result.analysisMeta.pipeline).toBe("two-stage");
  });

  it("fails with PARSE_ERROR when compose returns no JSON", async () => {
    const { fetcher } = recordingFetcher([
      geminiResponse({ text: memo }),
      geminiResponse({ text: roleMemo }),
      geminiResponse({ text: "메모만 되풀이", grounding: false }),
    ]);
    await expect(analyzeCompany(request, db, { fetcher, apiKey: "test-key", pipeline: "two-stage" })).rejects.toMatchObject({ code: "PARSE_ERROR" });
  });

  it("uses the two-stage pipeline by default and keeps single available on request", async () => {
    const byDefault = recordingFetcher([
      geminiResponse({ text: memo }),
      geminiResponse({ text: roleMemo }),
      geminiResponse({ text: JSON.stringify(REPORT), grounding: false }),
    ]);
    const result = await analyzeCompany(request, db, { fetcher: byDefault.fetcher, apiKey: "test-key" });
    expect(COMPANY_DEFAULT_PIPELINE).toBe("two-stage");
    expect(byDefault.calls).toHaveLength(3);
    expect(result.analysisMeta.pipeline).toBe("two-stage");

    const single = recordingFetcher([geminiResponse({ text: JSON.stringify(REPORT) })]);
    const singleResult = await analyzeCompany(request, db, { fetcher: single.fetcher, apiKey: "test-key", pipeline: "single" });
    expect(single.calls).toHaveLength(1);
    expect(singleResult.analysisMeta.pipeline).toBe("single");
    expect(singleResult.analysisMeta.stages.map((stage) => stage.name)).toEqual(["research"]);
  });
});
