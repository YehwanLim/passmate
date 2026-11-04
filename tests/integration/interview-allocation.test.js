import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { INTERVIEW_CONSENT_VERSION, createInterviewSessionDetailHandler, createInterviewSessionsHandler } from "../../lib/interview/interview-sessions.js";
import { seedEntitlementSettings, seedUser } from "./harness/seed.js";
import { createTestPrismaClient, prepareTestDatabase, resetTables } from "./harness/test-database.js";

const REPORT = {
  interviewQA: [{ question: "지원 동기를 말씀해 주세요.", followUps: [], modelAnswer: "" }],
  gaps: ["숫자 근거가 약해요"],
};

function response() {
  return {
    body: undefined,
    headers: {},
    statusCode: 200,
    json(payload) { this.body = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
  };
}

async function seedAnalysis(db, userId) {
  const project = await db.project.create({ data: { userId, title: "한빛모빌리티 서비스 기획", company: "한빛모빌리티", jobKeyword: "서비스 기획" } });
  const analysis = await db.analysis.create({
    data: { userId, projectId: project.id, kind: "RESUME", status: "SUCCESS", questionText: "[문항 1] 지원 동기", inputText: "[문항 1]\n가상의 자소서", aiResponseJson: REPORT },
  });
  return analysis.id;
}

describe("AI 면접 연습 세션 할당 (실제 로컬 DB)", () => {
  let db;
  let userId;
  let analysisId;
  const clock = { now: new Date() };
  const makeHandlers = () => {
    const deps = { db, requireUser: async () => ({ applicationUser: { id: userId } }), now: () => clock.now };
    return {
      sessions: createInterviewSessionsHandler(deps),
      detail: createInterviewSessionDetailHandler({ ...deps, issueToken: async () => ({ token: "fake-token" }), apiKey: () => "fake-key" }),
    };
  };
  const create = async (handlers, key) => {
    const res = response();
    await handlers.sessions({ method: "POST", headers: { "idempotency-key": key }, query: {}, body: { analysisId, consentVersion: INTERVIEW_CONSENT_VERSION } }, res);
    return res;
  };
  const act = async (handlers, sessionId, action, body) => {
    const res = response();
    await handlers.detail({ method: "POST", headers: {}, query: { sessionId, action }, body }, res);
    return res;
  };

  beforeAll(async () => {
    await prepareTestDatabase();
    db = createTestPrismaClient();
  }, 120_000);

  beforeEach(async () => {
    await resetTables(db);
    await seedEntitlementSettings(db);
    await db.entitlementSetting.update({ where: { id: "singleton" }, data: { interviewEnabled: true } });
    userId = await seedUser(db);
    await db.analysisEntitlement.update({ where: { userId }, data: { interviewCreditsGranted: 2 } });
    analysisId = await seedAnalysis(db, userId);
    clock.now = new Date();
  });

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("같은 멱등키로 동시에 보내면 세션과 예약이 하나만 생긴다", async () => {
    const handlers = makeHandlers();
    const results = await Promise.all(Array.from({ length: 4 }, () => create(handlers, "same-key-0000000001")));
    const ids = new Set(results.map((res) => res.body.session?.id));
    expect(results.every((res) => [200, 201, 409].includes(res.statusCode))).toBe(true);
    expect([...ids].filter(Boolean)).toHaveLength(1);
    expect(await db.interviewSession.count({ where: { userId } })).toBe(1);
    expect(await db.analysisReservation.count({ where: { userId, kind: "INTERVIEW", status: "PENDING" } })).toBe(1);
  });

  it("다른 멱등키로 동시에 보내도 진행 중 면접은 하나만 허용된다", async () => {
    const handlers = makeHandlers();
    const results = await Promise.all(["key-a-000000000000001", "key-b-000000000000001", "key-c-000000000000001"].map((key) => create(handlers, key)));
    const created = results.filter((res) => res.statusCode === 201);
    expect(created).toHaveLength(1);
    expect(results.filter((res) => res.body.error === "INTERVIEW_IN_PROGRESS").length + created.length).toBe(3);
    expect(await db.analysisReservation.count({ where: { userId, kind: "INTERVIEW", status: "PENDING" } })).toBe(1);
  });

  it("이용권이 2개면 첫 면접을 끝낸 뒤 둘째를 열 수 있고, 셋째는 이용권이 없어 거절된다", async () => {
    const handlers = makeHandlers();
    const first = await create(handlers, "first-key-00000000001");
    expect(first.statusCode).toBe(201);
    await act(handlers, first.body.session.id, "token", {});
    await act(handlers, first.body.session.id, "turns", { turns: [0, 1].map((seq) => ({ seq, speaker: "CANDIDATE", text: "답변", offsetMs: seq })) });
    clock.now = new Date(clock.now.getTime() + 5 * 60_000);
    const ended = await act(handlers, first.body.session.id, "end", { reason: "user-stop" });
    expect(ended.body.refunded).toBe(false);

    const second = await create(handlers, "second-key-0000000001");
    expect(second.statusCode).toBe(201);
    clock.now = new Date(clock.now.getTime() + 60_000);
    const refunded = await act(handlers, second.body.session.id, "end", { reason: "user-stop" });
    expect(refunded.body.refunded).toBe(true);

    const third = await create(handlers, "third-key-00000000001");
    expect(third.statusCode).toBe(201);
    const summaryReservations = await db.analysisReservation.findMany({ where: { userId, kind: "INTERVIEW" }, orderBy: { createdAt: "asc" } });
    expect(summaryReservations.map((row) => row.status)).toEqual(["PENDING", "CANCELLED", "PENDING"]);

    const fourth = await create(handlers, "fourth-key-0000000001");
    expect(fourth.statusCode).toBe(409);
    expect(["INTERVIEW_IN_PROGRESS", "INTERVIEW_CREDITS_EXHAUSTED"]).toContain(fourth.body.error);
  });

  it("사용자를 지우면 세션과 발언이 함께 지워지고 자소서 크레딧 예약은 건드리지 않는다", async () => {
    const handlers = makeHandlers();
    const created = await create(handlers, "delete-key-0000000001");
    await act(handlers, created.body.session.id, "token", {});
    await act(handlers, created.body.session.id, "turns", { turns: [{ seq: 0, speaker: "INTERVIEWER", text: "안녕하세요", offsetMs: 0 }] });
    expect(await db.interviewTurn.count()).toBe(1);
    await db.user.delete({ where: { id: userId } });
    expect(await db.interviewSession.count()).toBe(0);
    expect(await db.interviewTurn.count()).toBe(0);
  });
});
