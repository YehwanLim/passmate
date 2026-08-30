import { describe, expect, it } from "vitest";
import analyzeHandler from "../../api/analyze.js";
import { createResumeSplitHandler, normalizeSplitOutput } from "../../lib/resume-split.js";

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

const VALID_TEXT = "가".repeat(300);

function createHandler(overrides = {}) {
  return createResumeSplitHandler({
    callModel: async () => [{ question: "지원동기", answer: "열심히 하겠습니다." }],
    consumeRateLimit: async () => ({ allowed: true }),
    db: {},
    requireUser: async () => ({ applicationUser: { id: "user-1" } }),
    ...overrides,
  });
}

describe("resume split API", () => {
  it("split=1 쿼리로 들어온 미인증 요청은 401을 받는다 (analyze.js 배선 확인)", async () => {
    const response = createResponse();
    await analyzeHandler(
      { body: { text: VALID_TEXT }, headers: {}, method: "POST", query: { split: "1" } },
      response,
    );
    expect(response.statusCode).toBe(401);
    expect(response.body.error).toBe("AUTHENTICATION_REQUIRED");
  });

  it("POST 이외의 메서드는 405를 받는다", async () => {
    const response = createResponse();
    await createHandler()({ headers: {}, method: "GET", query: { split: "1" } }, response);
    expect(response.statusCode).toBe(405);
    expect(response.body.error).toBe("METHOD_NOT_ALLOWED");
  });

  it("text가 없거나 문자열이 아니면 400을 받는다", async () => {
    for (const body of [undefined, {}, { text: 123 }, { text: VALID_TEXT, extra: 1 }]) {
      const response = createResponse();
      await createHandler()({ body, headers: {}, method: "POST", query: { split: "1" } }, response);
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe("INVALID_REQUEST");
    }
  });

  it("너무 짧거나 긴 텍스트는 400을 받는다", async () => {
    for (const text of ["가".repeat(199), "가".repeat(20001)]) {
      const response = createResponse();
      await createHandler()(
        { body: { text }, headers: {}, method: "POST", query: { split: "1" } },
        response,
      );
      expect(response.statusCode).toBe(400);
      expect(response.body.error).toBe("INVALID_REQUEST");
    }
  });

  it("레이트리밋에 걸리면 429와 Retry-After를 받는다", async () => {
    const response = createResponse();
    await createHandler({
      consumeRateLimit: async () => ({ allowed: false, retryAfterSeconds: 42 }),
    })({ body: { text: VALID_TEXT }, headers: {}, method: "POST", query: { split: "1" } }, response);
    expect(response.statusCode).toBe(429);
    expect(response.body.error).toBe("RATE_LIMITED");
    expect(response.headers["Retry-After"]).toBe("42");
  });

  it("모델 결과를 questions 배열로 돌려준다", async () => {
    const response = createResponse();
    await createHandler()(
      { body: { text: VALID_TEXT }, headers: {}, method: "POST", query: { split: "1" } },
      response,
    );
    expect(response.statusCode).toBe(200);
    expect(response.body.questions).toEqual([
      { question: "지원동기", answer: "열심히 하겠습니다." },
    ]);
  });

  it("모델 호출이 실패하면 502 SPLIT_FAILED를 받는다", async () => {
    const response = createResponse();
    await createHandler({
      callModel: async () => {
        throw new Error("boom");
      },
    })({ body: { text: VALID_TEXT }, headers: {}, method: "POST", query: { split: "1" } }, response);
    expect(response.statusCode).toBe(502);
    expect(response.body.error).toBe("SPLIT_FAILED");
  });

  it("모델이 쓸 수 없는 형태를 돌려주면 502 SPLIT_FAILED를 받는다", async () => {
    const response = createResponse();
    await createHandler({ callModel: async () => ({ nope: true }) })(
      { body: { text: VALID_TEXT }, headers: {}, method: "POST", query: { split: "1" } },
      response,
    );
    expect(response.statusCode).toBe(502);
    expect(response.body.error).toBe("SPLIT_FAILED");
  });
});

describe("normalizeSplitOutput", () => {
  it("쌍을 다듬고 5개로 제한하며 질문을 300자로 자른다", () => {
    const pairs = Array.from({ length: 7 }, (_, i) => ({
      question: ` 질문 ${i + 1} `.padEnd(400, "가"),
      answer: ` 답변 ${i + 1} `,
    }));
    const normalized = normalizeSplitOutput({ questions: pairs });
    expect(normalized).toHaveLength(5);
    expect(normalized[0].question.length).toBeLessThanOrEqual(300);
    expect(normalized[0].answer).toBe("답변 1");
  });

  it("답변이 전부 비어 있으면 null을 돌려준다", () => {
    expect(normalizeSplitOutput({ questions: [{ question: "질문", answer: "  " }] })).toBeNull();
    expect(normalizeSplitOutput({ questions: [] })).toBeNull();
    expect(normalizeSplitOutput("garbage")).toBeNull();
  });

  it("최상위 배열 형태도 받아들인다", () => {
    expect(normalizeSplitOutput([{ question: "질문", answer: "답변" }])).toEqual([
      { question: "질문", answer: "답변" },
    ]);
  });
});
