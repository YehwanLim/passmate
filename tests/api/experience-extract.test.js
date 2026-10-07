import { afterEach, describe, expect, it, vi } from "vitest";
import analyzeHandler from "../../api/analyze.js";
import { buildExtractPrompt } from "../../shared/prompts/extractPrompt.js";
import { createExperienceExtractHandler, normalizeExtractOutput, normalizeExtractRequest } from "../../lib/experience-extract.js";
import { createResponse } from "../helpers/http.js";

const SOURCE = [
  "1. 지원 동기",
  "아버지 차에 블루링크를 연결해 드린 뒤 원격 공조를 한 번 쓰고 다시는 열지 않으시는 모습을 봤습니다.",
  "2. 경험",
  "동아리 추천 서비스의 재방문율이 떨어져 2024.09부터 3,000건의 로그를 직접 모아 분석했습니다.",
  "이탈 구간을 찾아 첫 화면을 바꾸는 실험을 2주 단위로 돌렸고 이탈률이 줄었습니다.",
].join("\n");

const candidate = (over = {}) => ({
  title: "로그 3,000건으로 찾은 이탈 원인",
  period: "2024.09~",
  situation: "동아리 추천 서비스의 재방문율이 떨어졌다",
  action: "3,000건의 로그를 직접 모아 이탈 구간을 찾고 2주 단위 실험을 돌렸다",
  result: "이탈률이 줄었다",
  tags: ["데이터 분석", "실험", "데이터 분석"],
  quotes: ["2024.09부터 3,000건의 로그를 직접 모아 분석했습니다."],
  ...over,
});

describe("normalizeExtractRequest", () => {
  it("text 만 받고 정리 후 200~20,000자", () => {
    expect(normalizeExtractRequest({ text: `  ${"가".repeat(200)}  ` })).toEqual({ text: "가".repeat(200) });
    for (const bad of [null, {}, { text: 1 }, { text: "가".repeat(199) }, { text: "가".repeat(20001) }, { text: "가".repeat(300), extra: 1 }]) {
      expect(() => normalizeExtractRequest(bad)).toThrow();
    }
  });
});

describe("normalizeExtractOutput", () => {
  it("근거가 원문에 있는 후보만 남긴다(공백·줄바꿈 차이는 봐준다)", () => {
    const out = normalizeExtractOutput({
      candidates: [
        candidate({ quotes: ["2024.09부터  3,000건의 로그를\n직접 모아 분석했습니다."] }),
        candidate({ title: "지어낸 경험", quotes: ["해외 봉사에서 팀장을 맡았습니다."] }),
      ],
    }, { sourceText: SOURCE });
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("로그 3,000건으로 찾은 이탈 원인");
  });

  it("8자 미만 근거는 근거로 치지 않는다", () => {
    expect(normalizeExtractOutput({ candidates: [candidate({ quotes: ["로그를"] })] }, { sourceText: SOURCE })).toEqual([]);
  });

  it("원문에 없는 숫자는 [실제 수치]로, 있는 숫자·점 날짜는 그대로", () => {
    const [out] = normalizeExtractOutput({
      candidates: [candidate({ result: "이탈률이 30% 줄었다" })],
    }, { sourceText: SOURCE });
    expect(out.result).toBe("이탈률이 [실제 수치] 줄었다");
    expect(out.action).toContain("3,000건");
    expect(out.period).toBe("2024.09~");
  });

  it("태그 중복 제거·5개·20자, 칸 길이는 금고 한도로 자른다", () => {
    const [out] = normalizeExtractOutput({
      candidates: [candidate({
        title: "가".repeat(150),
        situation: "나".repeat(2000),
        tags: ["a", "b", "c", "d", "e", "f", "가".repeat(30)],
      })],
    }, { sourceText: SOURCE });
    expect(out.title).toHaveLength(100);
    expect(out.situation).toHaveLength(1500);
    expect(out.tags).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("제목이 비면 버리고, 8개까지만, 근거는 2개까지", () => {
    const q = ["2024.09부터 3,000건의 로그를 직접 모아 분석했습니다.", "이탈 구간을 찾아 첫 화면을 바꾸는 실험을", "2주 단위로 돌렸고 이탈률이 줄었습니다."];
    const many = Array.from({ length: 10 }, (_, i) => candidate({ title: `경험 ${i}`, quotes: q }));
    const out = normalizeExtractOutput({ candidates: [candidate({ title: "  " }), ...many] }, { sourceText: SOURCE });
    expect(out).toHaveLength(8);
    expect(out[0].title).toBe("경험 [실제 수치]");
    expect(out[0].quotes).toHaveLength(2);
  });

  it("빠진 칸은 빈 문자열, 형태가 틀리면 null", () => {
    const [out] = normalizeExtractOutput({ candidates: [{ title: "추천 서비스 실험", quotes: [candidate().quotes[0]] }] }, { sourceText: SOURCE });
    expect(out).toEqual({ title: "추천 서비스 실험", period: "", situation: "", action: "", result: "", tags: [], quotes: [candidate().quotes[0]] });
    expect(normalizeExtractOutput("nope", { sourceText: SOURCE })).toBeNull();
    expect(normalizeExtractOutput({ candidates: "x" }, { sourceText: SOURCE })).toBeNull();
    expect(normalizeExtractOutput({ candidates: [] }, { sourceText: SOURCE })).toEqual([]);
  });
});

describe("buildExtractPrompt", () => {
  it("원문을 넣고, 금지 규칙은 필드 설명에 둔다", () => {
    const prompt = buildExtractPrompt({ text: SOURCE });
    expect(prompt).toContain(SOURCE);
    expect(prompt).toContain('"quotes"');
    expect(prompt).toContain("한 글자도 바꾸지 않고");
    expect(prompt).toContain("최대 8개");
  });
});

const USER = "11111111-1111-4111-8111-111111111111";
const TEXT = `${SOURCE}\n${"동아리 운영 기록을 정리했습니다. ".repeat(6)}`;
const okOutput = { candidates: [candidate()] };

function makeHandler(overrides = {}) {
  const deps = {
    callModel: vi.fn(async () => okOutput),
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 2 })),
    refundRateLimit: vi.fn(async () => {}),
    db: { experience: { count: vi.fn(async () => 3) } },
    requireUser: async () => ({ applicationUser: { id: USER } }),
    ...overrides,
  };
  return { deps, handler: createExperienceExtractHandler(deps) };
}

const post = (body) => ({ method: "POST", headers: {}, query: { extract: "1" }, body });

describe("POST /api/analyze?extract=1", () => {
  afterEach(() => vi.restoreAllMocks());

  it("extract=1 미인증은 401 (analyze.js 배선)", async () => {
    const res = createResponse();
    await analyzeHandler(post({ text: TEXT }), res);
    expect(res.statusCode).toBe(401);
  });

  it("POST 이외는 405", async () => {
    const { handler } = makeHandler();
    const res = createResponse();
    await handler({ ...post({ text: TEXT }), method: "GET" }, res);
    expect(res.statusCode).toBe(405);
  });

  it("짧은 글은 400, 횟수 차감 없음", async () => {
    const { deps, handler } = makeHandler();
    const res = createResponse();
    await handler(post({ text: "짧아요" }), res);
    expect(res.statusCode).toBe(400);
    expect(deps.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("성공하면 정리된 후보와 남은 횟수를 주고, 원문을 프롬프트에 넣는다", async () => {
    const { deps, handler } = makeHandler();
    const res = createResponse();
    await handler(post({ text: TEXT }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.remaining_today).toBe(2);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.candidates[0]).toMatchObject({ title: "로그 3,000건으로 찾은 이탈 원인", quotes: [candidate().quotes[0]] });
    expect(deps.callModel.mock.calls[0][0]).toBe(buildExtractPrompt({ text: normalizeExtractRequest({ text: TEXT }).text }));
    expect(deps.consumeRateLimit.mock.calls[0][1].policy.route).toBe("experience-extract");
    expect(deps.refundRateLimit).not.toHaveBeenCalled();
  });

  it("금고가 100개면 409, 횟수 차감·모델 호출 없음", async () => {
    const { deps, handler } = makeHandler({ db: { experience: { count: vi.fn(async () => 100) } } });
    const res = createResponse();
    await handler(post({ text: TEXT }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("EXPERIENCE_LIMIT_REACHED");
    expect(deps.consumeRateLimit).not.toHaveBeenCalled();
    expect(deps.callModel).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429, 모델을 부르지 않는다", async () => {
    const { deps, handler } = makeHandler({ consumeRateLimit: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 60 })) });
    const res = createResponse();
    await handler(post({ text: TEXT }), res);
    expect(res.statusCode).toBe(429);
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.refundRateLimit).not.toHaveBeenCalled();
  });

  it("모델 오류·형태가 틀린 출력은 502 EXTRACT_FAILED 이고 환불한다", async () => {
    for (const callModel of [vi.fn(async () => { throw new Error("timeout"); }), vi.fn(async () => "nope")]) {
      const { deps, handler } = makeHandler({ callModel });
      const res = createResponse();
      await handler(post({ text: TEXT }), res);
      expect(res.statusCode).toBe(502);
      expect(res.body.error).toBe("EXTRACT_FAILED");
      expect(deps.refundRateLimit).toHaveBeenCalledTimes(1);
    }
  });

  it("정리 후 0개면 200 빈 배열, 환불하고 남은 횟수를 되돌린 값으로 준다", async () => {
    const { deps, handler } = makeHandler({ callModel: vi.fn(async () => ({ candidates: [candidate({ quotes: ["원문에 없는 문장입니다 정말로"] })] })) });
    const res = createResponse();
    await handler(post({ text: TEXT }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ candidates: [], remaining_today: 3 });
    expect(deps.refundRateLimit).toHaveBeenCalledTimes(1);
  });

  it("어느 경로에서도 자소서 본문을 로그에 남기지 않는다", async () => {
    const spies = ["log", "info", "warn", "error"].map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
    for (const callModel of [vi.fn(async () => okOutput), vi.fn(async () => { throw new Error(TEXT); })]) {
      const { handler } = makeHandler({ callModel });
      await handler(post({ text: TEXT }), createResponse());
    }
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain("3,000건의 로그");
    }
  });
});
