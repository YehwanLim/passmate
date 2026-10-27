import { afterEach, describe, expect, it, vi } from "vitest";
import analyzeHandler, { selectAnalyzeHandler } from "../../api/analyze.js";
import { buildKeywordPrompt } from "../../shared/prompts/keywordPrompt.js";
import {
  createExperienceKeywordsHandler,
  knownKeywordsOf,
  normalizeKeywordOutput,
  normalizeKeywordRequest,
} from "../../lib/experience/experience-keywords.js";
import { createResponse } from "../helpers/http.js";

const USER = "11111111-1111-4111-8111-111111111111";
const BODY = { title: "카페 발주 개선", text: "판매 데이터를 보고 요일별 발주량을 조정해 폐기를 줄였다.", tags: ["카페"] };
const ROWS = [{ tags: ["데이터 분석", "카페"] }, { tags: ["데이터 분석", "협업"] }, { tags: [] }];

function makeHandler(overrides = {}) {
  const deps = {
    callModel: vi.fn(async () => ({ keywords: ["데이터분석", "운영 개선"] })),
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 19 })),
    refundRateLimit: vi.fn(async () => {}),
    db: { experience: { findMany: vi.fn(async () => ROWS) } },
    requireUser: async () => ({ applicationUser: { id: USER } }),
    ...overrides,
  };
  return { deps, handler: createExperienceKeywordsHandler(deps) };
}

const post = (body) => ({ method: "POST", headers: {}, query: { keywords: "1" }, body });

describe("normalizeKeywordRequest", () => {
  it("title·text·tags 만 받고, 이름+글이 20자 이상이어야 한다", () => {
    expect(normalizeKeywordRequest({ ...BODY, text: `  ${BODY.text}  ` })).toEqual({ title: BODY.title, text: BODY.text, current: ["카페"] });
    for (const bad of [null, {}, { title: "짧다" }, { ...BODY, extra: 1 }, { ...BODY, tags: "카페" }, { ...BODY, tags: [1] }, { ...BODY, tags: ["a", "b", "c", "d", "e", "f"] }]) {
      expect(() => normalizeKeywordRequest(bad)).toThrow();
    }
  });
});

describe("normalizeKeywordOutput", () => {
  it("이미 쓰는 표기로 맞추고(공백·대소문자 무시), 이미 붙인 것은 빼고, 2개까지", () => {
    const out = normalizeKeywordOutput(
      { keywords: ["데이터분석", "카페", "운영 개선", "협업", 3] },
      { known: ["데이터 분석", "카페", "협업"], current: ["카페"] },
    );
    expect(out).toEqual(["데이터 분석", "운영 개선"]);
  });

  it("형태가 틀리면 null, 20자로 자른다", () => {
    expect(normalizeKeywordOutput("nope", { known: [], current: [] })).toBeNull();
    expect(normalizeKeywordOutput({ keywords: ["가".repeat(30)] }, { known: [], current: [] })).toEqual(["가".repeat(20)]);
  });
});

describe("knownKeywordsOf", () => {
  it("자주 쓴 순, 같으면 가나다순", () => {
    expect(knownKeywordsOf(ROWS)).toEqual(["데이터 분석", "카페", "협업"]);
  });
});

describe("buildKeywordPrompt", () => {
  it("경험 글·이미 쓰는 키워드·이미 붙인 키워드를 넣고, 예시 단어는 넣지 않는다", () => {
    const prompt = buildKeywordPrompt({ title: BODY.title, text: BODY.text, known: ["데이터 분석"], current: ["카페"] });
    expect(prompt).toContain(BODY.text);
    expect(prompt).toContain("[이미 쓰는 키워드]\n데이터 분석");
    expect(prompt).toContain("[이미 붙인 키워드]\n카페");
    expect(prompt).toContain("2개까지");
  });
});

describe("POST /api/analyze?keywords=1", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keywords=1 미인증은 401 (analyze.js 배선), extract 다음 순서로 고른다", async () => {
    const res = createResponse();
    await analyzeHandler(post(BODY), res);
    expect(res.statusCode).toBe(401);
    const handlers = { company: 1, draft: 2, extract: 3, keywords: 4, posting: 5, resume: 6, split: 7 };
    expect(selectAnalyzeHandler({ keywords: "1" }, handlers)).toBe(4);
    expect(selectAnalyzeHandler({ keywords: "1", extract: "1" }, handlers)).toBe(3);
    expect(selectAnalyzeHandler({ keywords: "1", kind: "company" }, handlers)).toBe(4);
  });

  it("POST 이외는 405, 짧은 글은 400(횟수 차감 없음)", async () => {
    const { deps, handler } = makeHandler();
    const res = createResponse();
    await handler({ ...post(BODY), method: "GET" }, res);
    expect(res.statusCode).toBe(405);
    const short = createResponse();
    await handler(post({ title: "짧다", text: "", tags: [] }), short);
    expect(short.statusCode).toBe(400);
    expect(deps.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("성공하면 정리된 키워드와 남은 횟수를 주고, 내 금고 키워드만 프롬프트에 넣는다", async () => {
    const { deps, handler } = makeHandler();
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ keywords: ["데이터 분석", "운영 개선"], remaining_today: 19 });
    expect(deps.db.experience.findMany).toHaveBeenCalledWith({ where: { userId: USER }, select: { tags: true } });
    expect(deps.callModel.mock.calls[0][0]).toBe(
      buildKeywordPrompt({ title: BODY.title, text: BODY.text, known: ["데이터 분석", "카페", "협업"], current: ["카페"] }),
    );
    expect(deps.consumeRateLimit.mock.calls[0][1].policy.route).toBe("experience-keywords");
    expect(deps.refundRateLimit).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429, 모델을 부르지 않는다", async () => {
    const { deps, handler } = makeHandler({ consumeRateLimit: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 60 })) });
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.statusCode).toBe(429);
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it("모델 오류·형태가 틀린 출력은 502 KEYWORDS_FAILED 이고 환불한다", async () => {
    for (const callModel of [vi.fn(async () => { throw new Error("timeout"); }), vi.fn(async () => "nope")]) {
      const { deps, handler } = makeHandler({ callModel });
      const res = createResponse();
      await handler(post(BODY), res);
      expect(res.statusCode).toBe(502);
      expect(res.body.error).toBe("KEYWORDS_FAILED");
      expect(deps.refundRateLimit).toHaveBeenCalledTimes(1);
    }
  });

  it("고를 게 없으면 200 빈 배열, 환불하고 되돌린 횟수를 준다", async () => {
    const { deps, handler } = makeHandler({ callModel: vi.fn(async () => ({ keywords: ["카페"] })) });
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.body).toEqual({ keywords: [], remaining_today: 20 });
    expect(deps.refundRateLimit).toHaveBeenCalledTimes(1);
  });

  it("어느 경로에서도 경험 글을 로그에 남기지 않는다", async () => {
    const spies = ["log", "info", "warn", "error"].map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
    for (const callModel of [vi.fn(async () => ({ keywords: ["운영"] })), vi.fn(async () => { throw new Error(BODY.text); })]) {
      const { handler } = makeHandler({ callModel });
      await handler(post(BODY), createResponse());
    }
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain("요일별 발주량");
    }
  });
});
