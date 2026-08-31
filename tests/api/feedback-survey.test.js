import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFeedbackHandler } from "../../api/feedback.js";
import {
  SURVEY_MIN_COMMENT_LENGTH,
  SURVEY_QUESTION_KEYS,
} from "../../lib/feedback-survey.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ANALYSIS_ID = "22222222-2222-4222-8222-222222222222";
const FEEDBACK_ID = "33333333-3333-4333-8333-333333333333";

const LONG_COMMENT = "가".repeat(SURVEY_MIN_COMMENT_LENGTH);
const SHORT_COMMENT = "가".repeat(SURVEY_MIN_COMMENT_LENGTH - 1);

function fullScores(value = 8) {
  return Object.fromEntries(SURVEY_QUESTION_KEYS.map((key) => [key, value]));
}

function response() {
  return {
    body: undefined,
    statusCode: 200,
    setHeader() {},
    json(payload) {
      this.body = payload;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

/**
 * grantFeedbackCredit 은 실제 구현을 그대로 태운다 — 지급 조건이 이 테스트가
 * 지키려는 규칙 자체라, 목으로 대체하면 검증이 사라진다. DB 만 흉내 낸다.
 */
function fakeDb({ alreadyGranted = false } = {}) {
  const state = {
    grants: alreadyGranted ? [{ id: "existing", userId: USER_ID }] : [],
    bonusIncrements: [],
  };

  const tx = {
    feedback: {
      upsert: vi.fn(async () => ({
        id: FEEDBACK_ID,
        comment: LONG_COMMENT,
        createdAt: new Date("2026-08-31T00:00:00.000Z"),
      })),
    },
    analysisEntitlement: {
      upsert: vi.fn(async () => ({ userId: USER_ID })),
      findUnique: vi.fn(async () => ({ userId: USER_ID, bonusCreditsGranted: 0 })),
      update: vi.fn(async ({ data }) => {
        state.bonusIncrements.push(data.bonusCreditsGranted.increment);
        return { userId: USER_ID };
      }),
    },
    feedbackCreditGrant: {
      findUnique: vi.fn(async () => state.grants[0] ?? null),
      create: vi.fn(async ({ data }) => {
        state.grants.push({ id: "new", ...data });
        return data;
      }),
    },
    $queryRaw: vi.fn(async () => [{ id: USER_ID }]),
  };

  return {
    state,
    tx,
    analysis: { findFirst: vi.fn(async () => ({ id: ANALYSIS_ID })) },
    $transaction: vi.fn(async (fn) => fn(tx)),
  };
}

async function submit(db, body) {
  const handler = createFeedbackHandler({
    db,
    requireUser: async () => ({ applicationUser: { id: USER_ID } }),
  });
  const res = response();
  await handler(
    {
      body,
      headers: { authorization: "Bearer test-token" },
      method: "POST",
      url: "/api/feedback",
    },
    res,
  );
  return res;
}

const COMPLETE = { analysisId: ANALYSIS_ID, scores: fullScores(), comment: LONG_COMMENT };

describe("feedback survey submission", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores every score and grants one credit for a completed survey", async () => {
    const db = fakeDb();

    const res = await submit(db, COMPLETE);

    expect(res.statusCode).toBe(200);
    expect(res.body.credit_granted).toBe(true);
    expect(res.body.credits_granted).toBe(1);
    expect(db.state.bonusIncrements).toEqual([1]);

    const [args] = db.tx.feedback.upsert.mock.calls[0];
    expect(args.create).toMatchObject({
      scoreReflection: 8,
      scoreImprovement: 8,
      scoreRecommend: 8,
      comment: LONG_COMMENT,
    });
  });

  it("pays an account only once, however many reports it rates", async () => {
    const db = fakeDb({ alreadyGranted: true });

    const res = await submit(db, COMPLETE);

    expect(res.statusCode).toBe(200);
    expect(res.body.credit_granted).toBe(false);
    expect(db.state.bonusIncrements).toEqual([]);
    expect(db.tx.feedbackCreditGrant.create).not.toHaveBeenCalled();
  });

  it("rejects a survey with a missing question", async () => {
    const db = fakeDb();
    const scores = fullScores();
    delete scores[SURVEY_QUESTION_KEYS[0]];

    const res = await submit(db, { ...COMPLETE, scores });

    expect(res.statusCode).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects scores outside the 1-10 range", async () => {
    const db = fakeDb();

    for (const invalid of [0, 11, 5.5, "8", null]) {
      const scores = { ...fullScores(), recommend: invalid };
      const res = await submit(db, { ...COMPLETE, scores });
      expect(res.statusCode, `score ${invalid}`).toBe(400);
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects an unknown question key instead of silently dropping it", async () => {
    const db = fakeDb();
    const scores = { ...fullScores(), somethingElse: 9 };

    const res = await submit(db, { ...COMPLETE, scores });

    expect(res.statusCode).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a comment below the required length", async () => {
    const db = fakeDb();

    const res = await submit(db, { ...COMPLETE, comment: SHORT_COMMENT });

    expect(res.statusCode).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("counts trimmed length so whitespace cannot pad a short comment", async () => {
    const db = fakeDb();

    const res = await submit(db, { ...COMPLETE, comment: `   ${SHORT_COMMENT}   ` });

    expect(res.statusCode).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("locks the entitlement before reading the grant history", async () => {
    const db = fakeDb();

    await submit(db, COMPLETE);

    // 잠금이 조회보다 늦으면 동시 요청 두 건이 모두 "미지급"을 보고 통과한다.
    const lockOrder = db.tx.$queryRaw.mock.invocationCallOrder[0];
    const readOrder = db.tx.feedbackCreditGrant.findUnique.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(readOrder);
  });

  it("saves the survey and the grant in one transaction", async () => {
    const db = fakeDb();

    await submit(db, COMPLETE);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("rejects a survey on an analysis the requester does not own", async () => {
    const db = fakeDb();
    db.analysis.findFirst = vi.fn(async () => null);

    const res = await submit(db, COMPLETE);

    expect(res.statusCode).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects methods other than POST", async () => {
    const db = fakeDb();
    const handler = createFeedbackHandler({
      db,
      requireUser: async () => ({ applicationUser: { id: USER_ID } }),
    });
    const res = response();

    await handler({ body: COMPLETE, headers: {}, method: "GET", url: "/api/feedback" }, res);

    expect(res.statusCode).toBe(405);
  });
});
