import { describe, expect, it, vi } from "vitest";
import analyzeHandler from "../../api/analyze.js";
import { createExperienceDraftHandler, normalizeDraftOutput, normalizeDraftRequest } from "../../lib/experience-draft.js";
import { createResponse } from "../helpers/http.js";

const EXPS = [
  { id: "e1", title: "카페 단골 만들기", period: "2024", situation: "리뷰 2.8점", action: "불만 표 정리", result: "재방문 1,200명", tags: [] },
  { id: "e2", title: "동아리 회계", period: null, situation: "", action: "", result: "", tags: [] },
];
const ctx = { experiences: EXPS, postingText: "" };
const sentence = (text, kind = "experience", sourceIds = ["e1"]) => ({ text, kind, sourceIds });

describe("normalizeDraftOutput", () => {
  it("경험에 없는 숫자는 [실제 수치]로, 있는 숫자는 그대로(쉼표 무시)", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "고객 문제" }],
      sentences: [sentence("재방문을 1200명까지 늘렸고 매출은 30% 올랐습니다.")],
    }, ctx);
    expect(out.sentences[0].text).toBe("재방문을 1200명까지 늘렸고 매출은 [실제 수치] 올랐습니다.");
    expect(out.replacedNumbers).toBe(1);
  });

  it("단위 없는 숫자를 바꿀 때 뒤 공백은 남긴다", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "r" }],
      sentences: [sentence("매출 30 올랐습니다.")],
    }, ctx);
    expect(out.sentences[0].text).toBe("매출 [실제 수치] 올랐습니다.");
  });

  it("기간 2024.09~11 같은 점 표기는 연·월 숫자로도 인정한다(앞자리 0 무시)", () => {
    const exps = [{ id: "e3", title: "공모전", period: "2024.09~11", situation: "", action: "", result: "", tags: [] }];
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e3", reason: "r" }],
      sentences: [sentence("2024년 9월부터 11월까지 진행했고 3번 수정했습니다.", "experience", ["e3"])],
    }, { experiences: exps, postingText: "" });
    expect(out.sentences[0].text).toBe("2024년 9월부터 11월까지 진행했고 [실제 수치]번 수정했습니다.");
    expect(out.replacedNumbers).toBe(1);
  });

  it("남의 경험 id 는 버리고, 출처가 빈 experience 문장은 unsourced", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "x9", reason: "?" }, { experienceId: "e1", reason: "맞음" }],
      sentences: [sentence("팀을 이끌었습니다.", "experience", ["x9"])],
    }, ctx);
    expect(out.chosen).toEqual([{ experienceId: "e1", title: "카페 단골 만들기", reason: "맞음" }]);
    expect(out.sentences[0]).toMatchObject({ sourceIds: [], unsourced: true });
  });

  it("job·plan 문장의 숫자는 공고 글과 비교한다", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "r" }],
      sentences: [sentence("이 직무는 3개 서비스를 맡습니다.", "job", [])],
    }, { experiences: EXPS, postingText: "3개 서비스 운영" });
    expect(out.sentences[0].text).toBe("이 직무는 3개 서비스를 맡습니다.");
  });

  it("문단은 kind 가 바뀔 때 빈 줄로 나누고 글자 수를 센다", () => {
    const out = normalizeDraftOutput({
      status: "ok",
      chosen: [{ experienceId: "e1", reason: "r" }],
      sentences: [sentence("가.", "job", []), sentence("나.", "experience"), sentence("다.", "plan", [])],
    }, ctx);
    expect(out.draftText).toBe("가.\n\n나.\n\n다.");
    expect(out.charCount).toBe(out.draftText.length);
  });

  it("needs_more 는 문장 하나만 돌려준다", () => {
    expect(normalizeDraftOutput({ status: "needs_more", needMore: "팀 갈등을 푼 경험이 필요해요" }, ctx))
      .toEqual({ status: "needs_more", needMore: "팀 갈등을 푼 경험이 필요해요" });
  });

  it("문장이 하나도 안 남거나 형태가 틀리면 null", () => {
    expect(normalizeDraftOutput({ status: "ok", chosen: [], sentences: [] }, ctx)).toBeNull();
    expect(normalizeDraftOutput("nope", ctx)).toBeNull();
  });
});

const USER = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const okOutput = { status: "ok", chosen: [{ experienceId: "e1", reason: "r" }], sentences: [{ text: "재방문 1200명", kind: "experience", sourceIds: ["e1"] }] };

function makeDb({ experiences = EXPS, project } = {}) {
  return {
    project: {
      findFirst: vi.fn(async ({ where }) => (where.userId === USER
        ? (project ?? { id: PROJECT, company: "CJ", jobKeyword: "기획", jobPostingId: null, questions: [{ draftExperienceIds: ["e2"] }] })
        : null)),
    },
    experience: { findMany: vi.fn(async () => experiences) },
    jobPosting: { findFirst: vi.fn(async () => null) },
  };
}

function makeHandler(overrides = {}) {
  const deps = {
    callModel: vi.fn(async () => okOutput),
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 1 })),
    refundRateLimit: vi.fn(async () => {}),
    db: makeDb(),
    requireUser: async () => ({ applicationUser: { id: USER } }),
    ...overrides,
  };
  return { deps, handler: createExperienceDraftHandler(deps) };
}

const post = (body) => ({ method: "POST", headers: {}, query: { draft: "1" }, body });
const BODY = { projectId: PROJECT, prompt: "지원 동기", charLimit: 800 };

describe("POST /api/analyze?draft=1", () => {
  it("draft=1 미인증은 401 (analyze.js 배선)", async () => {
    const res = createResponse();
    await analyzeHandler(post(BODY), res);
    expect(res.statusCode).toBe(401);
  });

  it("요청은 projectId(uuid)·prompt 필수, 모르는 키는 400", () => {
    expect(normalizeDraftRequest(BODY)).toEqual({ projectId: PROJECT, prompt: "지원 동기", charLimit: 800, avoidExperienceIds: [] });
    for (const bad of [{}, { ...BODY, projectId: "p1" }, { ...BODY, prompt: "" }, { ...BODY, extra: 1 }, { ...BODY, charLimit: 0 }, { ...BODY, avoidExperienceIds: "e1" }]) {
      expect(() => normalizeDraftRequest(bad)).toThrow();
    }
  });

  it("POST 이외는 405", async () => {
    const { handler } = makeHandler();
    const res = createResponse();
    await handler({ ...post(BODY), method: "GET" }, res);
    expect(res.statusCode).toBe(405);
  });

  it("성공하면 정규화된 초안과 남은 개수를 돌려주고, 다른 문항의 경험을 피할 경험으로 넘긴다", async () => {
    const { deps, handler } = makeHandler();
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", draft_text: "재방문 1200명", remaining_today: 1, replaced_numbers: 0 });
    expect(res.body.chosen[0]).toEqual({ experience_id: "e1", title: "카페 단골 만들기", reason: "r" });
    expect(res.body.sentences[0]).toEqual({ text: "재방문 1200명", kind: "experience", source_ids: ["e1"], unsourced: false });
    expect(deps.callModel.mock.calls[0][0]).toContain("[피할 경험] E2");
    expect(deps.refundRateLimit).not.toHaveBeenCalled();
  });

  it("남의 지원서는 404, 횟수 차감 없음", async () => {
    const { deps, handler } = makeHandler({ requireUser: async () => ({ applicationUser: { id: "intruder" } }) });
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.statusCode).toBe(404);
    expect(deps.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("경험이 0개면 422 NO_EXPERIENCES, 횟수 차감 없음", async () => {
    const { deps, handler } = makeHandler({ db: makeDb({ experiences: [] }) });
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe("NO_EXPERIENCES");
    expect(deps.consumeRateLimit).not.toHaveBeenCalled();
  });

  it("한도를 넘으면 429, 모델을 부르지 않는다", async () => {
    const { deps, handler } = makeHandler({ consumeRateLimit: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 60 })) });
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.statusCode).toBe(429);
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(deps.refundRateLimit).not.toHaveBeenCalled();
  });

  it("모델 실패·쓸 수 없는 출력은 502 DRAFT_FAILED 이고 환불한다", async () => {
    for (const callModel of [vi.fn(async () => { throw new Error("boom"); }), vi.fn(async () => ({ status: "ok", sentences: [] }))]) {
      const { deps, handler } = makeHandler({ callModel });
      const res = createResponse();
      await handler(post(BODY), res);
      expect(res.statusCode).toBe(502);
      expect(res.body.error).toBe("DRAFT_FAILED");
      expect(deps.refundRateLimit).toHaveBeenCalledTimes(1);
    }
  });

  it("needs_more 는 그대로 전하고 환불한다", async () => {
    const { deps, handler } = makeHandler({ callModel: vi.fn(async () => ({ status: "needs_more", needMore: "협업 경험이 필요해요" })) });
    const res = createResponse();
    await handler(post(BODY), res);
    expect(res.body).toEqual({ status: "needs_more", need_more: "협업 경험이 필요해요", remaining_today: 2 });
    expect(deps.refundRateLimit).toHaveBeenCalledTimes(1);
  });

  it("모델에는 짧은 별칭(E1·E2)만 보이고, 응답은 실제 id 로 되돌린다(긴 uuid 를 모델이 틀리게 베끼는 문제)", async () => {
    const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const exps = [
      { ...EXPS[0], id: A },
      { ...EXPS[1], id: B },
    ];
    const db = makeDb({ experiences: exps, project: { id: PROJECT, company: "CJ", jobKeyword: null, jobPostingId: null, questions: [{ draftExperienceIds: [B] }] } });
    const callModel = vi.fn(async () => ({
      status: "ok",
      chosen: [{ experienceId: "E1", reason: "r" }],
      sentences: [{ text: "재방문 1200명", kind: "experience", sourceIds: ["e1"] }],
    }));
    const { handler } = makeHandler({ db, callModel });
    const res = createResponse();
    await handler(post(BODY), res);
    const prompt = callModel.mock.calls[0][0];
    expect(prompt).toContain("[경험 id=E1]");
    expect(prompt).toContain("[피할 경험] E2");
    expect(prompt).not.toContain(A);
    expect(res.body.chosen[0].experience_id).toBe(A);
    expect(res.body.sentences[0]).toMatchObject({ source_ids: [A], unsourced: false, text: "재방문 1200명" });
  });

  it("공고가 붙어 있으면 본인 공고만 읽어 프롬프트에 넣는다", async () => {
    const db = makeDb({ project: { id: PROJECT, company: "CJ", jobKeyword: null, jobPostingId: "p1", questions: [] } });
    db.jobPosting.findFirst = vi.fn(async ({ where }) => (where.userId === USER ? { rawText: "공고 본문", summaryJson: { requirements: ["SQL"] } } : null));
    const { deps, handler } = makeHandler({ db });
    await handler(post(BODY), createResponse());
    expect(db.jobPosting.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", userId: USER } }));
    expect(deps.callModel.mock.calls[0][0]).toContain("SQL");
  });
});
