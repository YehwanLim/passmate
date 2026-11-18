import { describe, expect, it, vi } from "vitest";

import analyzeHandler, { selectAnalyzeHandler } from "../../api/analyze.js";
import {
  PHOTO_LIMITS,
  createInterviewFeedbackHandler,
  normalizeFeedbackRequest,
  runInterviewFeedback,
  sanitizeFeedback,
} from "../../lib/interview/interview-feedback.js";
import { INTERVIEW_RULES } from "../../lib/interview/interview-lifecycle.js";
import { buildFeedbackPrompt } from "../../shared/prompts/interviewPrompt.js";
import { createResponse } from "../helpers/http.js";
import { INTERVIEW_TEST_ANALYSIS, INTERVIEW_TEST_USER, createInterviewMemoryDb } from "../helpers/interview-db.js";

const SESSION_ID = "55555555-5555-4555-8555-555555555555";
// JPEG 는 FF D8 FF 로 시작한다(base64 "/9j/"). 서버는 그 앞머리를 검사한다.
const PHOTO = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("fake-jpeg-bytes")]).toString("base64");
const NOT_JPEG = Buffer.from("fake-png-bytes").toString("base64");

const GOOD_OUTPUT = {
  summary: "경험을 순서대로 말한 점이 좋았어요. 숫자의 근거를 먼저 말하면 훨씬 좋아질 것 같아요.",
  answers: [
    {
      question: "로그 분석에서 맡은 역할은?",
      whatWorked: "직접 모은 로그라고 분명히 말했어요.",
      whatToImprove: "'3,000건'이 어디서 나온 수인지 바로 이어서 말하면 어떨까요.",
      evidenceTurnSeqs: [1, 3],
      nextAttempt: "먼저 역할, 그다음 숫자의 출처, 마지막에 바뀐 점 순서로 말해 보세요.",
    },
    { question: "지원 동기", whatWorked: "", whatToImprove: "자신감이 없어 보였어요.", evidenceTurnSeqs: [], nextAttempt: "" },
  ],
  delivery: {
    available: true,
    items: [
      { category: "GAZE", observation: "12장 중 7장에서 시선이 화면 아래를 향했어요.", suggestion: "답을 시작할 때 카메라를 한 번 보는 습관을 만들어 보세요.", supportingPhotoCount: 7 },
      { category: "POSTURE", observation: "2장에서 손이 얼굴을 가렸어요.", suggestion: "손은 책상 위에 두세요.", supportingPhotoCount: 2 },
      { category: "MOOD", observation: "표정이 밝았어요.", suggestion: "유지하세요.", supportingPhotoCount: 12 },
      { category: "FRAMING", observation: "긴장한 듯 보였어요.", suggestion: "편하게.", supportingPhotoCount: 12 },
    ],
  },
};

function seedEndedSession(db, overrides = {}) {
  const reservation = { id: "66666666-6666-4666-8666-666666666666", userId: INTERVIEW_TEST_USER, kind: "INTERVIEW", source: "PREMIUM", status: "PENDING" };
  db.state.reservations.push(reservation);
  db.state.sessions.push({
    id: SESSION_ID,
    userId: INTERVIEW_TEST_USER,
    analysisId: INTERVIEW_TEST_ANALYSIS,
    reservationId: reservation.id,
    idempotencyKey: "k",
    mode: "FULL",
    status: "ENDED",
    tokenIssueCount: 1,
    feedbackStatus: "NONE",
    feedbackJson: null,
    feedbackAttempts: 0,
    feedbackHadVideo: false,
    createdAt: new Date(),
    endedAt: new Date(),
    ...overrides,
  });
  db.state.turns.push(
    { id: "t0", sessionId: SESSION_ID, seq: 0, speaker: "INTERVIEWER", text: "로그 분석에서 맡은 역할은?", interrupted: false, partial: false, offsetMs: 0 },
    { id: "t1", sessionId: SESSION_ID, seq: 1, speaker: "CANDIDATE", text: "제가 직접 로그 3,000건을 모았습니다.", interrupted: false, partial: false, offsetMs: 4000 },
  );
}

function makeHandler(db, overrides = {}) {
  const deps = {
    db,
    requireUser: async () => ({ applicationUser: { id: INTERVIEW_TEST_USER } }),
    callModel: vi.fn(async () => GOOD_OUTPUT),
    consumeRateLimit: vi.fn(async () => ({ allowed: true, remaining: 5 })),
    ...overrides,
  };
  return { deps, handler: createInterviewFeedbackHandler(deps) };
}

const post = (body) => ({ method: "POST", headers: {}, query: { interview_feedback: "1" }, body });

describe("normalizeFeedbackRequest", () => {
  it("세션 id 와 JPEG base64 사진 12장까지, JPEG 가 아니면 400, 크기 상한을 넘기면 413", () => {
    expect(normalizeFeedbackRequest({ sessionId: SESSION_ID, photos: [PHOTO] })).toEqual({ sessionId: SESSION_ID, photos: [PHOTO] });
    expect(normalizeFeedbackRequest({ sessionId: SESSION_ID }).photos).toEqual([]);
    for (const bad of [null, { sessionId: "x" }, { sessionId: SESSION_ID, photos: "a" }, { sessionId: SESSION_ID, photos: ["not base64!"] }, { sessionId: SESSION_ID, photos: [NOT_JPEG] }, { sessionId: SESSION_ID, photos: ["AAAA"] }, { sessionId: SESSION_ID, photos: Array.from({ length: PHOTO_LIMITS.count + 1 }, () => PHOTO) }]) {
      expect(() => normalizeFeedbackRequest(bad)).toThrow(expect.objectContaining({ statusCode: 400 }));
    }
    const huge = `/9j/${"A".repeat(Math.ceil((PHOTO_LIMITS.eachBytes + 1000) / 3) * 4)}`;
    expect(() => normalizeFeedbackRequest({ sessionId: SESSION_ID, photos: [huge] })).toThrow(expect.objectContaining({ statusCode: 413 }));
  });
});

describe("sanitizeFeedback", () => {
  it("감정·점수·외모 표현이 든 항목과 사진 3장 미만 관찰, 모르는 분류는 버린다", () => {
    const clean = sanitizeFeedback(GOOD_OUTPUT, { photoCount: 12 });
    expect(clean.summary).toContain("훨씬 좋아질 것 같아요");
    expect(clean.answers).toHaveLength(1);
    expect(clean.answers[0]).toMatchObject({ question: "로그 분석에서 맡은 역할은?", evidenceTurnSeqs: [1, 3] });
    expect(clean.delivery).toEqual({
      available: true,
      photoCount: 12,
      items: [expect.objectContaining({ category: "GAZE", supportingPhotoCount: 7 })],
    });
    expect(clean.disclaimer).toContain("자동 받아쓰기");
  });

  it("사진이 없으면 전달 항목을 비우고, 쓸 내용이 없으면 null", () => {
    const noPhoto = sanitizeFeedback(GOOD_OUTPUT, { photoCount: 0 });
    expect(noPhoto.delivery).toEqual({ available: false, photoCount: 0, items: [] });
    expect(sanitizeFeedback({ summary: "점수는 85점이에요", answers: [] }, { photoCount: 0 })).toBeNull();
    expect(sanitizeFeedback("nope", { photoCount: 0 })).toBeNull();
  });

  it("지원자 말을 인용한 숫자·퍼센트·'성격' 같은 일상어는 버리지 않는다", () => {
    const quoted = sanitizeFeedback({
      summary: "전환율 15% 개선이라는 수치를 먼저 말한 점이 좋았어요.",
      answers: [
        { question: "성격의 장단점은?", whatWorked: "'제 성격은 꼼꼼합니다'라고 바로 답했어요.", whatToImprove: "평점 4.0점이었다는 근거를 이어서 말하면 어떨까요.", evidenceTurnSeqs: [1], nextAttempt: "" },
        { question: "지원 동기", whatWorked: "", whatToImprove: "불합격할 것 같아요.", evidenceTurnSeqs: [], nextAttempt: "" },
      ],
    }, { photoCount: 0 });
    expect(quoted.summary).toContain("15%");
    expect(quoted.answers).toHaveLength(1);
    expect(quoted.answers[0].whatToImprove).toContain("4.0점");
  });

  it("피드백 프롬프트는 대화·발언 번호·사진 수를 담고 점수를 쓰지 말라고 한다", () => {
    const prompt = buildFeedbackPrompt({ company: "한빛", jobRole: "기획", photoCount: 12, questions: [{ question: "지원 동기" }], transcript: [
      { seq: 0, speaker: "INTERVIEWER", text: "질문", interrupted: false },
      { seq: 1, speaker: "CANDIDATE", text: "답변", interrupted: true },
    ] });
    expect(prompt).toContain("면접관(0): 질문");
    expect(prompt).toContain("지원자(1)[끊김]: 답변");
    expect(prompt).toContain("12장");
    expect(prompt).toContain("점수·등급·퍼센트·합격 가능성은 쓰지 않습니다");
  });
});

describe("POST /api/analyze?interview_feedback=1", () => {
  it("배선: 미인증은 401, keywords 다음 순서로 고른다", async () => {
    const res = createResponse();
    await analyzeHandler(post({ sessionId: SESSION_ID }), res);
    expect(res.statusCode).toBe(401);
    const handlers = { company: 1, draft: 2, extract: 3, keywords: 4, posting: 5, resume: 6, split: 7, interviewFeedback: 8 };
    expect(selectAnalyzeHandler({ interview_feedback: "1" }, handlers)).toBe(8);
    expect(selectAnalyzeHandler({ interview_feedback: "1", keywords: "1" }, handlers)).toBe(4);
    expect(selectAnalyzeHandler({ interview_feedback: "1", kind: "company" }, handlers)).toBe(8);
  });

  it("끝난 세션만 받는다: 진행 중 409, 남의 세션 404, 답변 없는 세션 422", async () => {
    const active = createInterviewMemoryDb();
    seedEndedSession(active, { status: "ACTIVE" });
    const res = createResponse();
    await makeHandler(active).handler(post({ sessionId: SESSION_ID }), res);
    expect(res.body.error).toBe("INTERVIEW_NOT_ENDED");

    const missing = createResponse();
    await makeHandler(createInterviewMemoryDb()).handler(post({ sessionId: SESSION_ID }), missing);
    expect(missing.statusCode).toBe(404);

    const silent = createInterviewMemoryDb();
    seedEndedSession(silent);
    silent.state.turns = silent.state.turns.filter((turn) => turn.speaker !== "CANDIDATE");
    const empty = createResponse();
    await makeHandler(silent).handler(post({ sessionId: SESSION_ID }), empty);
    expect(empty.statusCode).toBe(422);
  });

  it("접수하면 202 를 주고, 배경 작업이 성공하면 피드백을 저장하고 이용권을 확정한다", async () => {
    const db = createInterviewMemoryDb();
    seedEndedSession(db);
    const work = [];
    const { deps, handler } = makeHandler(db, { enqueueBackgroundWork: (run) => work.push(run()) });
    const res = createResponse();
    await handler(post({ sessionId: SESSION_ID, photos: [PHOTO, PHOTO, PHOTO] }), res);
    expect(res.statusCode).toBe(202);
    expect(res.body.feedback_status).toBe("PENDING");
    await Promise.all(work);

    const session = db.state.sessions[0];
    expect(session.feedbackStatus).toBe("SUCCEEDED");
    expect(session.feedbackHadVideo).toBe(true);
    expect(session.feedbackJson.answers).toHaveLength(1);
    expect(db.state.reservations[0].status).toBe("CONSUMED");
    // 모델에는 대화 글과 사진이 간다. 사진은 저장되지 않는다.
    const call = deps.callModel.mock.calls[0][0];
    expect(call.photos).toHaveLength(3);
    expect(call.prompt).toContain("로그 3,000건");
    expect(JSON.stringify(db.state.sessions)).not.toContain(PHOTO);
    expect(db.state.audits.map((audit) => audit.outcome)).toContain("FEEDBACK_SUCCEEDED");

    // 이미 끝난 세션에 다시 요청하면 200.
    const again = createResponse();
    await handler(post({ sessionId: SESSION_ID }), again);
    expect(again.statusCode).toBe(200);
  });

  it("모델이 실패하면 FAILED 로 남기고, 상한까지 실패하면 이용권을 돌려준다", async () => {
    const db = createInterviewMemoryDb();
    seedEndedSession(db);
    const callModel = vi.fn(async () => { throw new Error("model down"); });
    for (let attempt = 1; attempt <= INTERVIEW_RULES.feedbackMaxAttempts; attempt += 1) {
      await db.interviewSession.update({ where: { id: SESSION_ID }, data: { feedbackStatus: "PENDING" } });
      await runInterviewFeedback({ db, sessionId: SESSION_ID, userId: INTERVIEW_TEST_USER, photos: [], callModel, requestId: "r" });
      expect(db.state.sessions[0]).toMatchObject({ feedbackStatus: "FAILED", feedbackAttempts: attempt, feedbackJson: { failure: "error" } });
    }
    expect(db.state.reservations[0].status).toBe("CANCELLED");
    expect(db.state.turns).toHaveLength(2);

    const exhausted = createResponse();
    await makeHandler(db).handler(post({ sessionId: SESSION_ID }), exhausted);
    expect(exhausted.body.error).toBe("INTERVIEW_FEEDBACK_EXHAUSTED");
  });

  it("모델이 금지 표현만 돌려주면 실패로 세지만, 상한까지 그래도 이용권은 돌려주지 않는다(대화 글로 환불을 유도하는 길을 막는다)", async () => {
    const db = createInterviewMemoryDb();
    seedEndedSession(db);
    const unusable = async () => ({ summary: "점수는 80점. 자신감이 없어 보였어요.", answers: [] });
    for (let attempt = 1; attempt <= INTERVIEW_RULES.feedbackMaxAttempts; attempt += 1) {
      await db.interviewSession.update({ where: { id: SESSION_ID }, data: { feedbackStatus: "PENDING" } });
      await runInterviewFeedback({ db, sessionId: SESSION_ID, userId: INTERVIEW_TEST_USER, photos: [], callModel: unusable, requestId: "r" });
      expect(db.state.sessions[0]).toMatchObject({ feedbackStatus: "FAILED", feedbackJson: { failure: "unusable" }, feedbackAttempts: attempt });
    }
    expect(db.state.reservations[0].status).toBe("CONSUMED");
    expect(db.state.audits.map((audit) => audit.outcome)).toContain("FEEDBACK_UNUSABLE");
  });

  it("제공자가 사진이 든 요청을 거절하면(4xx) 같은 시도 안에서 사진 없이 다시 부르고, 사진 피드백만 뺀다", async () => {
    const db = createInterviewMemoryDb();
    seedEndedSession(db, { feedbackStatus: "PENDING" });
    const callModel = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error("bad image"), { statusCode: 400 }))
      .mockResolvedValueOnce(GOOD_OUTPUT);
    await runInterviewFeedback({ db, sessionId: SESSION_ID, userId: INTERVIEW_TEST_USER, photos: [PHOTO, PHOTO, PHOTO], callModel, requestId: "r" });
    expect(callModel).toHaveBeenCalledTimes(2);
    expect(callModel.mock.calls[1][0].photos).toEqual([]);
    expect(db.state.sessions[0]).toMatchObject({ feedbackStatus: "SUCCEEDED", feedbackHadVideo: false, feedbackAttempts: 1 });
    expect(db.state.reservations[0].status).toBe("CONSUMED");
  });

  it("리포트 없이 시작한 세션도 세션에 저장한 회사·직무로 피드백을 만든다", async () => {
    const db = createInterviewMemoryDb();
    seedEndedSession(db, { analysisId: null, company: "새벽물산", jobRole: "영업 관리", feedbackStatus: "PENDING" });
    const callModel = vi.fn(async () => GOOD_OUTPUT);
    await runInterviewFeedback({ db, sessionId: SESSION_ID, userId: INTERVIEW_TEST_USER, photos: [], callModel, requestId: "r" });
    expect(JSON.stringify(callModel.mock.calls[0][0])).toContain("새벽물산 영업 관리 면접관");
    expect(JSON.stringify(callModel.mock.calls[0][0])).not.toContain("면접관이 준비했던 질문");
    expect(db.state.sessions[0]).toMatchObject({ feedbackStatus: "SUCCEEDED" });
  });

  it("같은 세션에 요청이 동시에 와도 모델은 한 번만 부른다", async () => {
    const db = createInterviewMemoryDb();
    seedEndedSession(db);
    const work = [];
    const { deps, handler } = makeHandler(db, { enqueueBackgroundWork: (run) => work.push(run()) });
    const [first, second] = [createResponse(), createResponse()];
    await Promise.all([handler(post({ sessionId: SESSION_ID }), first), handler(post({ sessionId: SESSION_ID }), second)]);
    await Promise.all(work);
    expect([first.statusCode, second.statusCode]).toEqual([202, 202]);
    expect(deps.callModel).toHaveBeenCalledTimes(1);
    expect(db.state.sessions[0].feedbackAttempts).toBe(1);
  });

  it("스위치를 끄면 피드백 요청도 503 이고, 호출 제한에 걸리면 429 다", async () => {
    const db = createInterviewMemoryDb({ interviewEnabled: false });
    seedEndedSession(db);
    const off = createResponse();
    await makeHandler(db).handler(post({ sessionId: SESSION_ID }), off);
    expect(off.statusCode).toBe(503);
    expect(off.body.error).toBe("INTERVIEW_DISABLED");

    const limited = createInterviewMemoryDb();
    seedEndedSession(limited);
    const res = createResponse();
    await makeHandler(limited, { consumeRateLimit: async () => ({ allowed: false, remaining: 0, resetAt: new Date() }) }).handler(post({ sessionId: SESSION_ID }), res);
    expect(res.statusCode).toBe(429);
    expect(limited.state.sessions[0].feedbackStatus).toBe("NONE");
  });
});
