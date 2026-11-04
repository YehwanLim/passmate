import { describe, expect, it, vi } from "vitest";

import accountHandler, { createAccountRoutesHandler } from "../../api/account/[...route].js";
import {
  INTERVIEW_CONSENT_VERSION,
  INTERVIEW_LIMITS,
  createInterviewSessionDetailHandler,
  createInterviewSessionsHandler,
  interviewMaterialFromReport,
  normalizeCreateRequest,
  normalizeEndRequest,
  normalizeTurns,
} from "../../lib/interview/interview-sessions.js";
import { INTERVIEW_RULES } from "../../lib/interview/interview-lifecycle.js";
import { buildLiveSessionConfig, buildLiveTokenBody, issueLiveToken, liveSocketUrl } from "../../lib/interview/live-token.js";
import { INTERVIEW_PROMPT_VERSION, buildInterviewerInstruction } from "../../shared/prompts/interviewPrompt.js";
import { createResponse } from "../helpers/http.js";
import { INTERVIEW_TEST_ANALYSIS, INTERVIEW_TEST_USER, SAMPLE_REPORT, createInterviewMemoryDb } from "../helpers/interview-db.js";

const KEY = "interview-key-0000001";
const T0 = new Date("2026-11-04T10:00:00Z");
const at = (minutes) => new Date(T0.getTime() + minutes * 60_000);

function post(body, { key = KEY, query = {} } = {}) {
  return { method: "POST", headers: { "idempotency-key": key }, query, body };
}

const DEFAULT_CLOCK = { now: T0 };
/** 가짜 DB 와 핸들러가 같은 시계를 보게 한다. 생성 시각이 실제 시계로 적히면 10분 TTL 에 걸려 모두 만료로 보인다. */
function newDb(options = {}, clock = DEFAULT_CLOCK) {
  return createInterviewMemoryDb({ now: () => clock.now, ...options });
}

function makeHandlers(db, { clock = DEFAULT_CLOCK, issueToken } = {}) {
  const now = () => clock.now;
  const deps = {
    db,
    requireUser: async () => ({ applicationUser: { id: INTERVIEW_TEST_USER } }),
    now,
  };
  const token = issueToken ?? vi.fn(async () => ({ token: "secret-token-name" }));
  return {
    issueToken: token,
    sessions: createInterviewSessionsHandler({ ...deps, consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 2 })) }),
    detail: createInterviewSessionDetailHandler({ ...deps, issueToken: token, apiKey: () => "server-key" }),
  };
}

async function createSession(handlers, body = { analysisId: INTERVIEW_TEST_ANALYSIS, consentVersion: INTERVIEW_CONSENT_VERSION }) {
  const res = createResponse();
  await handlers.sessions(post(body), res);
  return res;
}

async function act(handlers, sessionId, action, body, method = "POST") {
  const res = createResponse();
  await handlers.detail({ method, headers: {}, query: { sessionId, ...(action ? { action } : {}) }, body }, res);
  return res;
}

describe("요청 정규화", () => {
  it("리포트 id·모드·동의 버전만 받고, 동의 버전이 다르면 거부한다", () => {
    expect(normalizeCreateRequest({ analysisId: INTERVIEW_TEST_ANALYSIS, consentVersion: INTERVIEW_CONSENT_VERSION })).toEqual({
      analysisId: INTERVIEW_TEST_ANALYSIS,
      mode: "FULL",
      consentVersion: INTERVIEW_CONSENT_VERSION,
    });
    expect(normalizeCreateRequest({ analysisId: INTERVIEW_TEST_ANALYSIS, mode: "SHORT", consentVersion: INTERVIEW_CONSENT_VERSION }).mode).toBe("SHORT");
    expect(() => normalizeCreateRequest({ analysisId: INTERVIEW_TEST_ANALYSIS, consentVersion: "old" })).toThrow(expect.objectContaining({ code: "INTERVIEW_CONSENT_REQUIRED" }));
    for (const bad of [null, {}, { analysisId: "nope", consentVersion: INTERVIEW_CONSENT_VERSION }, { analysisId: INTERVIEW_TEST_ANALYSIS, consentVersion: INTERVIEW_CONSENT_VERSION, extra: 1 }, { analysisId: INTERVIEW_TEST_ANALYSIS, mode: "LONG", consentVersion: INTERVIEW_CONSENT_VERSION }]) {
      expect(() => normalizeCreateRequest(bad)).toThrow();
    }
  });

  it("발언은 순번·화자·글·시각을 검사하고 글자 수를 제한한다", () => {
    const turn = { seq: 0, speaker: "CANDIDATE", text: " 안녕하세요 ", offsetMs: 10, interrupted: "yes" };
    expect(normalizeTurns({ turns: [turn] })).toEqual([{ seq: 0, speaker: "CANDIDATE", text: "안녕하세요", offsetMs: 10, interrupted: false, partial: false }]);
    for (const bad of [{}, { turns: [] }, { turns: [{ ...turn, seq: -1 }] }, { turns: [{ ...turn, speaker: "ROBOT" }] }, { turns: [{ ...turn, text: "가".repeat(INTERVIEW_LIMITS.turnChars + 1) }] }, { turns: [{ ...turn, offsetMs: 1.5 }] }, { turns: Array.from({ length: INTERVIEW_LIMITS.turnsPerRequest + 1 }, () => turn) }]) {
      expect(() => normalizeTurns(bad)).toThrow();
    }
  });

  it("종료 사유는 정해진 값만 받고, 사용량 보고는 참고용으로만 남긴다", () => {
    expect(normalizeEndRequest({ reason: "user-stop", clientReportedUsage: { totalTokens: 10 } })).toEqual({ reason: "user-stop", clientReportedUsage: { totalTokens: 10 } });
    expect(normalizeEndRequest({ reason: "closed", clientReportedUsage: "x" }).clientReportedUsage).toBeNull();
    expect(() => normalizeEndRequest({ reason: "whatever" })).toThrow();
  });

  it("리포트에서 질문·꼬리 질문·약한 곳을 꺼내고 모범 답변과 강조 표시는 버린다", () => {
    const material = interviewMaterialFromReport(SAMPLE_REPORT);
    expect(material.questions).toEqual([
      { question: "지원 동기를 말씀해 주세요.", followUps: ["왜 이 직무인가요?"] },
      { question: "로그 분석에서 맡은 역할은?", followUps: [] },
    ]);
    expect(material.gaps).toEqual(["협업 이야기가 빠져 있어요", "숫자 근거가 약해요"]);
    expect(JSON.stringify(material)).not.toContain("모범 답변");
    expect(interviewMaterialFromReport({ interviewQA: "nope" })).toEqual({ questions: [], gaps: [] });
  });
});

describe("면접관 지시와 입장권 설정", () => {
  it("자소서·질문·약한 곳을 담고 모범 답변은 넣지 않으며, 짧은 연습은 질문을 2개로 줄인다", () => {
    const material = interviewMaterialFromReport(SAMPLE_REPORT);
    const instruction = buildInterviewerInstruction({ company: "한빛모빌리티", jobRole: "서비스 기획", coverLetter: "자소서 본문", ...material, mode: "FULL" });
    expect(instruction).toContain("한빛모빌리티 서비스 기획의 면접관");
    expect(instruction).toContain("1. 지원 동기를 말씀해 주세요.");
    expect(instruction).toContain("협업 이야기가 빠져 있어요");
    expect(instruction).toContain("자소서 본문");
    expect(instruction).toContain("카메라 화면에 대해서는 말하지 않습니다");
    const many = { ...material, questions: Array.from({ length: 8 }, (_, index) => ({ question: `질문 ${index + 1}`, followUps: [] })) };
    const short = buildInterviewerInstruction({ coverLetter: "", ...many, mode: "SHORT" });
    expect(short).toContain("2. 질문 2");
    expect(short).not.toContain("3. 질문 3");
    expect(short).toContain("5분짜리");
  });

  it("설정은 음성 응답·받아쓰기·압축·이어받기를 켜고, 토큰 본문은 1회용에 모델을 잠근다", () => {
    const config = buildLiveSessionConfig({ systemInstruction: "면접관" });
    expect(config.generationConfig.responseModalities).toEqual(["AUDIO"]);
    expect(config.inputAudioTranscription).toEqual({});
    expect(config.outputAudioTranscription).toEqual({});
    expect(config.contextWindowCompression).toEqual({ slidingWindow: { targetTokens: "20000" }, triggerTokens: "40000" });
    expect(config.sessionResumption).toEqual({});
    const body = buildLiveTokenBody({ config, expireAt: at(17), newSessionExpireAt: at(2) });
    expect(body.uses).toBe(1);
    expect(body.bidiGenerateContentSetup.model).toBe("models/gemini-3.8-live");
    expect(body.bidiGenerateContentSetup.systemInstruction.parts[0].text).toBe("면접관");
    expect(body.bidiGenerateContentSetup.sessionResumption).toBeUndefined();
    expect(body.fieldMask.split(",")).toEqual(expect.arrayContaining(["model", "systemInstruction", "generationConfig"]));
    expect(body.fieldMask).not.toContain("sessionResumption");
    expect(body.expireTime).toBe(at(17).toISOString());
    expect(liveSocketUrl("a b")).toContain("BidiGenerateContentConstrained?access_token=a%20b");
  });

  it("토큰 발급은 키를 헤더로 보내고, 거절되면 본문 없이 상태 코드만 남긴다", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ name: "tok" }) }));
    const config = buildLiveSessionConfig({ systemInstruction: "x" });
    await expect(issueLiveToken({ apiKey: "k", config, expireAt: at(1), newSessionExpireAt: at(1), fetcher })).resolves.toEqual({ token: "tok" });
    expect(fetcher.mock.calls[0][0]).toContain("/v1beta/auth_tokens");
    expect(fetcher.mock.calls[0][1].headers["x-goog-api-key"]).toBe("k");
    const rejecting = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "secret config echo" } }) }));
    await expect(issueLiveToken({ apiKey: "k", config, expireAt: at(1), newSessionExpireAt: at(1), fetcher: rejecting })).rejects.toMatchObject({ code: "LIVE_TOKEN_REJECTED", httpStatus: 403 });
    await expect(issueLiveToken({ apiKey: "", config, expireAt: at(1), newSessionExpireAt: at(1), fetcher })).rejects.toMatchObject({ code: "LIVE_API_KEY_MISSING" });
  });
});

describe("POST /api/account/interview-sessions", () => {
  it("라우터 배선: 미인증 요청은 401 이고 하위 경로가 sessionId·action 으로 들어온다", async () => {
    const res = createResponse();
    await accountHandler({ method: "POST", headers: {}, query: { route: ["interview-sessions"] }, body: {} }, res);
    expect(res.statusCode).toBe(401);

    const detail = vi.fn(async (req, out) => out.status(200).json({ q: req.query }));
    const router = createAccountRoutesHandler({ interviewSessionDetailHandler: detail });
    const routed = createResponse();
    await router({ method: "POST", headers: {}, query: { route: ["interview-sessions", "abc", "token"] } }, routed);
    expect(routed.body.q).toEqual({ route: ["interview-sessions", "abc", "token"], sessionId: "abc", action: "token" });
  });

  it("세션을 만들면 이용권 1회가 예약되고, 같은 멱등키로 다시 보내면 같은 세션을 돌려준다", async () => {
    const db = newDb();
    const handlers = makeHandlers(db);

    const first = await createSession(handlers);
    expect(first.statusCode).toBe(201);
    expect(first.body.session).toMatchObject({ status: "CREATED", mode: "FULL", company: "한빛모빌리티", analysis_id: INTERVIEW_TEST_ANALYSIS, token_issue_count: 0 });
    expect(first.body.session).not.toHaveProperty("userId");
    expect(db.state.reservations).toEqual([expect.objectContaining({ kind: "INTERVIEW", source: "PREMIUM", status: "PENDING" })]);
    expect(db.state.sessions[0]).toMatchObject({ promptVersion: INTERVIEW_PROMPT_VERSION, consentVersion: INTERVIEW_CONSENT_VERSION });

    const replay = await createSession(handlers);
    expect(replay.statusCode).toBe(200);
    expect(replay.body.session.id).toBe(first.body.session.id);
    expect(db.state.reservations).toHaveLength(1);

    const reused = createResponse();
    await handlers.sessions(post({ analysisId: INTERVIEW_TEST_ANALYSIS, mode: "SHORT", consentVersion: INTERVIEW_CONSENT_VERSION }), reused);
    expect(reused.statusCode).toBe(409);
    expect(reused.body.error).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("스위치가 꺼졌으면 503, 이용권이 없으면 409 이고 예약은 생기지 않는다", async () => {
    const disabled = makeHandlers(newDb({ interviewEnabled: false }));
    expect((await createSession(disabled)).body.error).toBe("INTERVIEW_DISABLED");

    const db = newDb({ interviewCredits: 0 });
    const res = await createSession(makeHandlers(db));
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("INTERVIEW_CREDITS_EXHAUSTED");
    expect(db.state.reservations).toHaveLength(0);
  });

  it("남의 리포트·기업 리포트·실패한 리포트로는 시작할 수 없고(404), 질문이 없는 리포트는 422", async () => {
    const other = makeHandlers(newDb());
    expect((await createSession(other, { analysisId: "33333333-3333-4333-8333-333333333333", consentVersion: INTERVIEW_CONSENT_VERSION })).statusCode).toBe(404);
    expect((await createSession(makeHandlers(newDb({ analysisStatus: "FAILED" })))).statusCode).toBe(404);
    const empty = await createSession(makeHandlers(newDb({ report: { interviewQA: [] } })));
    expect(empty.statusCode).toBe(422);
    expect(empty.body.error).toBe("INTERVIEW_SOURCE_UNAVAILABLE");
  });

  it("진행 중인 면접이 있으면 두 번째는 409, 멱등키가 없으면 400", async () => {
    const db = newDb({ interviewCredits: 3 });
    const handlers = makeHandlers(db);
    await createSession(handlers);
    const second = createResponse();
    await handlers.sessions(post({ analysisId: INTERVIEW_TEST_ANALYSIS, consentVersion: INTERVIEW_CONSENT_VERSION }, { key: "another-key-00000002" }), second);
    expect(second.statusCode).toBe(409);
    expect(second.body.error).toBe("INTERVIEW_IN_PROGRESS");
    const noKey = createResponse();
    await handlers.sessions({ method: "POST", headers: {}, body: {} }, noKey);
    expect(noKey.body.error).toBe("INVALID_IDEMPOTENCY_KEY");
  });

  it("GET 은 내 세션 목록을 최신순으로 돌려준다", async () => {
    const db = newDb();
    const handlers = makeHandlers(db);
    await createSession(handlers);
    const res = createResponse();
    await handlers.sessions({ method: "GET", headers: {}, query: { analysisId: INTERVIEW_TEST_ANALYSIS } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sessions).toHaveLength(1);
    const bad = createResponse();
    await handlers.sessions({ method: "GET", headers: {}, query: { analysisId: "nope" } }, bad);
    expect(bad.statusCode).toBe(400);
  });
});

describe("입장권·대화 글·종료", () => {
  it("첫 입장권으로 ACTIVE 가 되고 마감이 정해지며, 응답은 캐시되지 않고 토큰 이름 자체는 주소에만 들어간다", async () => {
    const db = newDb();
    const handlers = makeHandlers(db);
    const { body: { session } } = await createSession(handlers);

    const res = await act(handlers, session.id, "token", {});
    expect(res.statusCode).toBe(200);
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(res.body.socket_url).toContain("access_token=secret-token-name");
    expect(res.body.hard_deadline_at).toBe(at(16).toISOString());
    expect(res.body.expires_at).toBe(at(17).toISOString());
    expect(res.body.token_issue_count).toBe(1);
    expect(db.state.sessions[0]).toMatchObject({ status: "ACTIVE", tokenIssueCount: 1 });
    // 토큰에 잠긴 설정에 면접관 지시와 자소서가 들어간다. 브라우저 응답에는 없다.
    const issued = handlers.issueToken.mock.calls[0][0];
    expect(issued.config.systemInstruction.parts[0].text).toContain("로그 3,000건");
    expect(issued.apiKey).toBe("server-key");
    expect(JSON.stringify(res.body)).not.toContain("로그 3,000건");
    expect(db.state.audits.map((audit) => audit.outcome)).toEqual(["CREATED", "STARTED"]);
  });

  it("재발급은 마감 전 5회까지이고, 토큰 호출이 실패하면 횟수를 되돌린다", async () => {
    const clock = { now: T0 };
    const db = newDb({}, clock);
    const failing = vi.fn()
      .mockResolvedValueOnce({ token: "t1" })
      .mockRejectedValueOnce(Object.assign(new Error("x"), { code: "LIVE_TOKEN_REJECTED" }))
      .mockResolvedValue({ token: "t" });
    const handlers = makeHandlers(db, { clock, issueToken: failing });
    const { body: { session } } = await createSession(handlers);
    await act(handlers, session.id, "token", {});

    const failed = await act(handlers, session.id, "token", {});
    expect(failed.statusCode).toBe(502);
    expect(failed.body.error).toBe("INTERVIEW_TOKEN_FAILED");
    expect(db.state.sessions[0].tokenIssueCount).toBe(1);

    for (let count = 2; count <= INTERVIEW_RULES.maxTokenIssues; count += 1) {
      expect((await act(handlers, session.id, "token", {})).statusCode).toBe(200);
    }
    const exceeded = await act(handlers, session.id, "token", {});
    expect(exceeded.statusCode).toBe(409);
    expect(exceeded.body.error).toBe("INTERVIEW_TOKEN_LIMIT");

    clock.now = at(17);
    expect((await act(handlers, session.id, "token", {})).body.error).toBe("INTERVIEW_NOT_OPEN");
  });

  it("마감이 지나면 묵은 세션 정리가 INTERRUPTED 로 바꾸고 입장권을 거절한다", async () => {
    const clock = { now: T0 };
    const db = newDb({}, clock);
    const handlers = makeHandlers(db, { clock });
    const { body: { session } } = await createSession(handlers);
    await act(handlers, session.id, "token", {});
    clock.now = at(16);
    const res = await act(handlers, session.id, "token", {});
    expect(res.statusCode).toBe(409);
    expect(db.state.sessions[0]).toMatchObject({ status: "INTERRUPTED", endReason: "deadline" });
    // 이용권은 그대로 사용한 것으로 남는다(예약 PENDING).
    expect(db.state.reservations[0].status).toBe("PENDING");
  });

  it("입장권을 받지 않은 채 10분이 지나면 취소되고 이용권이 돌아온다", async () => {
    const clock = { now: T0 };
    const db = newDb({}, clock);
    const handlers = makeHandlers(db, { clock });
    await createSession(handlers);
    clock.now = at(10);
    const list = createResponse();
    await handlers.sessions({ method: "GET", headers: {}, query: {} }, list);
    expect(list.body.sessions[0].status).toBe("CANCELLED");
    expect(db.state.reservations[0].status).toBe("CANCELLED");
  });

  it("대화 글은 순번으로 멱등 저장되고, 미완성(partial) 글은 확정 글을 덮지 않는다", async () => {
    const db = newDb();
    const handlers = makeHandlers(db);
    const { body: { session } } = await createSession(handlers);
    const beforeToken = await act(handlers, session.id, "turns", { turns: [{ seq: 0, speaker: "INTERVIEWER", text: "안녕하세요", offsetMs: 0 }] });
    expect(beforeToken.statusCode).toBe(409);
    await act(handlers, session.id, "token", {});

    const saved = await act(handlers, session.id, "turns", { turns: [
      { seq: 0, speaker: "INTERVIEWER", text: "안녕하세요", offsetMs: 0 },
      { seq: 1, speaker: "CANDIDATE", text: "저는 봄샘 프로젝트를", offsetMs: 3000, partial: true },
    ] });
    expect(saved.body.saved).toBe(2);
    await act(handlers, session.id, "turns", { turns: [{ seq: 1, speaker: "CANDIDATE", text: "저는 봄샘 프로젝트를 맡았습니다.", offsetMs: 3000 }] });
    await act(handlers, session.id, "turns", { turns: [{ seq: 1, speaker: "CANDIDATE", text: "저는", offsetMs: 3000, partial: true }] });
    expect(db.state.turns.find((turn) => turn.seq === 1)).toMatchObject({ text: "저는 봄샘 프로젝트를 맡았습니다.", partial: false });

    const detail = await act(handlers, session.id, null, undefined, "GET");
    expect(detail.statusCode).toBe(200);
    expect(detail.headers["Cache-Control"]).toBe("no-store");
    expect(detail.body.session.turns.map((turn) => turn.seq)).toEqual([0, 1]);
    expect(detail.body.session.feedback).toBeNull();
  });

  it("세션당 글자 수를 넘기면 413", async () => {
    const db = newDb();
    const handlers = makeHandlers(db);
    const { body: { session } } = await createSession(handlers);
    await act(handlers, session.id, "token", {});
    const big = "가".repeat(INTERVIEW_LIMITS.turnChars);
    const turns = Array.from({ length: 16 }, (_, seq) => ({ seq, speaker: "CANDIDATE", text: big, offsetMs: seq }));
    const res = await act(handlers, session.id, "turns", { turns });
    expect(res.statusCode).toBe(413);
    expect(db.state.turns).toHaveLength(0);
  });

  it("2분 안에 답변 2회 미만으로 끝내면 돌려주고, 그 뒤 정상 종료는 사용한 것으로 남긴다", async () => {
    const clock = { now: T0 };
    const db = newDb({ interviewCredits: 2 }, clock);
    const handlers = makeHandlers(db, { clock });
    const { body: { session } } = await createSession(handlers);
    await act(handlers, session.id, "token", {});
    clock.now = at(1);
    const early = await act(handlers, session.id, "end", { reason: "user-stop" });
    expect(early.body).toMatchObject({ refunded: true, session: { status: "CANCELLED" } });
    expect(db.state.reservations[0].status).toBe("CANCELLED");
    expect(db.state.sessions[0].earlyRefundAt).toEqual(at(1));

    const again = createResponse();
    await handlers.sessions(post({ analysisId: INTERVIEW_TEST_ANALYSIS, consentVersion: INTERVIEW_CONSENT_VERSION }, { key: "second-key-000000002" }), again);
    expect(again.statusCode).toBe(201);
    const second = again.body.session.id;
    await act(handlers, second, "token", {});
    await act(handlers, second, "turns", { turns: [0, 1].map((seq) => ({ seq, speaker: "CANDIDATE", text: "답변", offsetMs: seq })) });
    clock.now = at(14);
    const ended = await act(handlers, second, "end", { reason: "time-up", clientReportedUsage: { total: 12 } });
    expect(ended.body).toMatchObject({ refunded: false, session: { status: "ENDED", end_reason: "time-up" } });
    expect(db.state.reservations[1].status).toBe("PENDING");
    expect(db.state.sessions[1].clientReportedUsage).toEqual({ total: 12 });
    // 끝난 뒤 종료를 다시 보내도 상태가 바뀌지 않는다.
    expect((await act(handlers, second, "end", { reason: "closed" })).body.session.status).toBe("ENDED");
  });

  it("남의 세션은 404, 모르는 동작은 404, GET 외 상세는 405", async () => {
    const db = newDb();
    const handlers = makeHandlers(db);
    expect((await act(handlers, "44444444-4444-4444-8444-444444444444", "token", {})).statusCode).toBe(404);
    expect((await act(handlers, "not-a-uuid", null, undefined, "GET")).statusCode).toBe(404);
    const { body: { session } } = await createSession(handlers);
    expect((await act(handlers, session.id, "dance", {})).statusCode).toBe(404);
    expect((await act(handlers, session.id, null, undefined, "POST")).statusCode).toBe(405);
  });
});
