import { describe, expect, it, vi } from "vitest";
import analyzeHandler, { selectAnalyzeHandler } from "../../api/analyze.js";
import { ApiError } from "../../lib/api-handler.js";
import {
  MAX_POSTING_CHARS,
  createJobPostingHandler,
  normalizePostingRequest,
  normalizePostingSummary,
} from "../../lib/job-posting.js";
import { createResponse } from "../helpers/http.js";

const VALID_TEXT = "수행 업무: 데이터 기반 서비스 기획. 자격요건: 고객 데이터 분석 경험. ".repeat(6);
const VALID_URL = "https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=1";
const MODEL_OUTPUT = {
  title: "서비스 기획 신입 채용",
  company: "현대자동차",
  role: "서비스 기획",
  responsibilities: ["고객 데이터 기반 서비스 개선"],
  requirements: ["고객 데이터를 읽고 개선안을 낸 경험", "유관 부서 조율 경험"],
  preferred: ["SQL 활용 경험"],
  keywords: ["고객 데이터", "서비스 개선", "부서 조율"],
};

function createDb(overrides = {}) {
  return {
    jobPosting: {
      create: vi.fn(async ({ data }) => ({ id: "posting-1", ...data })),
      ...overrides,
    },
  };
}

function createHandler(overrides = {}) {
  return createJobPostingHandler({
    callModel: async () => MODEL_OUTPUT,
    consumeRateLimit: async () => ({ allowed: true }),
    db: createDb(),
    fetchText: async () => VALID_TEXT,
    requireUser: async () => ({ applicationUser: { id: "user-1" } }),
    ...overrides,
  });
}

function post(body) {
  return { body, headers: {}, method: "POST", query: { posting: "1" } };
}

describe("job posting API", () => {
  it("posting=1 쿼리로 들어온 미인증 요청은 401을 받는다 (analyze.js 배선 확인)", async () => {
    const response = createResponse();
    await analyzeHandler(post({ text: VALID_TEXT }), response);
    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe("AUTHENTICATION_REQUIRED");
  });

  it("selectAnalyzeHandler 는 posting 을 company 보다 먼저, split 보다 뒤에 고른다", () => {
    const handlers = { company: () => {}, posting: () => {}, resume: () => {}, split: () => {} };
    expect(selectAnalyzeHandler({ posting: "1" }, handlers)).toBe(handlers.posting);
    expect(selectAnalyzeHandler({ posting: "1", kind: "company" }, handlers)).toBe(handlers.posting);
    expect(selectAnalyzeHandler({ posting: "1", split: "1" }, handlers)).toBe(handlers.split);
    expect(selectAnalyzeHandler({}, handlers)).toBe(handlers.resume);
  });

  it("POST 이외의 메서드는 405를 받는다", async () => {
    const response = createResponse();
    await createHandler()({ headers: {}, method: "GET", query: { posting: "1" } }, response);
    expect(response.statusCode).toBe(405);
  });

  it("url 과 text 정확히 하나만 받는다", () => {
    for (const body of [undefined, {}, { url: VALID_URL, text: VALID_TEXT }, { text: VALID_TEXT, extra: 1 }, { url: 1 }, { text: 1 }]) {
      expect(() => normalizePostingRequest(body)).toThrow(ApiError);
    }
    expect(normalizePostingRequest({ text: VALID_TEXT })).toEqual({ text: VALID_TEXT.trim() });
    expect(normalizePostingRequest({ url: ` ${VALID_URL} ` })).toEqual({ url: VALID_URL });
  });

  it("text 는 정리 후 200~6,000자, url 은 http(s) 와 2,048자 이내만 받는다", () => {
    expect(() => normalizePostingRequest({ text: "가".repeat(199) })).toThrow(ApiError);
    expect(() => normalizePostingRequest({ text: "가".repeat(MAX_POSTING_CHARS + 1) })).toThrow(ApiError);
    expect(() => normalizePostingRequest({ text: `<script>alert(1)</script>${"가".repeat(150)}` })).toThrow(ApiError);
    expect(() => normalizePostingRequest({ url: "ftp://example.com/a" })).toThrow(ApiError);
    expect(() => normalizePostingRequest({ url: `https://e.com/${"a".repeat(2100)}` })).toThrow(ApiError);
    expect(() => normalizePostingRequest({ url: "javascript:alert(1)" })).toThrow(ApiError);
  });

  it("레이트리밋에 걸리면 429와 Retry-After를 받는다", async () => {
    const response = createResponse();
    await createHandler({
      consumeRateLimit: async () => ({ allowed: false, retryAfterSeconds: 42 }),
    })(post({ text: VALID_TEXT }), response);
    expect(response.statusCode).toBe(429);
    expect(response.body.error).toBe("RATE_LIMITED");
    expect(response.headers["Retry-After"]).toBe("42");
  });

  it("텍스트 본문을 요약해 저장하고 접수 필드명을 돌려준다", async () => {
    const db = createDb();
    const response = createResponse();
    await createHandler({ db })(post({ text: VALID_TEXT }), response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      job_posting_id: "posting-1",
      source_url: null,
      summary: MODEL_OUTPUT,
      char_count: VALID_TEXT.trim().length,
    });
    expect(db.jobPosting.create).toHaveBeenCalledWith(expect.objectContaining({
      data: { userId: "user-1", sourceUrl: null, rawText: VALID_TEXT.trim(), summaryJson: MODEL_OUTPUT },
    }));
  });

  it("URL 본문은 fetchText 로 읽어 정리한 뒤 저장하며 source_url 을 남긴다", async () => {
    const db = createDb();
    const fetchText = vi.fn(async () => `<b>${VALID_TEXT}</b>`);
    const response = createResponse();
    await createHandler({ db, fetchText })(post({ url: VALID_URL }), response);
    expect(fetchText).toHaveBeenCalledWith(VALID_URL);
    expect(response.statusCode).toBe(200);
    expect(response.body.source_url).toBe(VALID_URL);
    expect(db.jobPosting.create.mock.calls[0][0].data.rawText).toBe(VALID_TEXT.trim());
  });

  it("URL 본문이 6,000자를 넘으면 앞부분만 저장한다", async () => {
    const db = createDb();
    const response = createResponse();
    await createHandler({ db, fetchText: async () => "가".repeat(MAX_POSTING_CHARS + 500) })(post({ url: VALID_URL }), response);
    expect(response.statusCode).toBe(200);
    expect(db.jobPosting.create.mock.calls[0][0].data.rawText).toHaveLength(MAX_POSTING_CHARS);
  });

  it("URL 본문이 200자 미만이거나 fetchText 가 실패하면 422 POSTING_URL_UNREADABLE 을 받는다", async () => {
    for (const fetchText of [async () => "짧은 본문", async () => { throw new ApiError("POSTING_URL_UNREADABLE", 422); }]) {
      const response = createResponse();
      await createHandler({ fetchText })(post({ url: VALID_URL }), response);
      expect(response.statusCode).toBe(422);
      expect(response.body.error).toBe("POSTING_URL_UNREADABLE");
    }
  });

  it("SSRF 가드가 거부한 URL 은 400 그대로 전달된다", async () => {
    const response = createResponse();
    await createHandler({ fetchText: async () => { throw new ApiError("INVALID_REQUEST", 400); } })(post({ url: "http://10.0.0.1/" }), response);
    expect(response.statusCode).toBe(400);
    expect(response.body.error).toBe("INVALID_REQUEST");
  });

  it("모델이 공고가 아니라고 하거나 자격요건·키워드가 모두 비면 422 POSTING_NOT_RECOGNIZED", async () => {
    for (const output of [{ error: "NOT_JOB_POSTING" }, { title: "x", requirements: [], keywords: [] }, "문자열", null]) {
      const response = createResponse();
      await createHandler({ callModel: async () => output })(post({ text: VALID_TEXT }), response);
      expect(response.statusCode).toBe(422);
      expect(response.body.error).toBe("POSTING_NOT_RECOGNIZED");
    }
  });

  it("모델 호출이 실패하면 502 POSTING_EXTRACT_FAILED", async () => {
    const response = createResponse();
    await createHandler({ callModel: async () => { throw new Error("boom"); } })(post({ text: VALID_TEXT }), response);
    expect(response.statusCode).toBe(502);
    expect(response.body.error).toBe("POSTING_EXTRACT_FAILED");
  });

  it("normalizePostingSummary 는 목록 상한·중복·태그를 정리하고 없는 필드를 채운다", () => {
    const summary = normalizePostingSummary({
      title: "<b>제목</b>",
      requirements: ["a", "a", 1, ...Array.from({ length: 10 }, (_, i) => `요건 ${i}`)],
      keywords: ["  키워드  "],
      extra: true,
    });
    expect(summary.title).toBe("제목");
    expect(summary.company).toBe("");
    expect(summary.requirements).toHaveLength(8);
    expect(summary.requirements[0]).toBe("a");
    expect(summary.requirements[1]).toBe("요건 0");
    expect(summary.keywords).toEqual(["키워드"]);
    expect(summary.preferred).toEqual([]);
    expect(summary.responsibilities).toEqual([]);
    expect(summary.extra).toBeUndefined();
  });
});
