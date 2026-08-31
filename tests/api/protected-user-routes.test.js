import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../lib/auth.js";
import { createAnalysisHandler } from "../../api/analysis/[id].js";
import { createFeedbackHandler } from "../../api/feedback.js";
import { createProjectDetailHandler } from "../../api/projects/[projectId]/index.js";
import { createProjectsHandler } from "../../api/projects.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";

// 설문은 5문항 점수와 100자 이상 주관식이 모두 있어야 접수된다.
const SURVEY_SCORES = { reflection: 8, improvement: 8, recommend: 8 };
const SURVEY_COMMENT = "가".repeat(50);

function request(overrides = {}) {
  return {
    body: undefined,
    headers: {},
    method: "GET",
    query: {},
    ...overrides,
  };
}

function response() {
  return {
    headers: {},
    statusCode: null,
    body: undefined,
    end: vi.fn(),
    json(body) {
      this.body = body;
      return body;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

const activeUser = async () => ({ applicationUser: { id: USER_ID } });

describe("protected user APIs", () => {
  it("returns an authorization code and request ID without exposing the authorization message", async () => {
    const handler = createProjectsHandler({
      db: {},
      requireUser: async () => {
        throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "sensitive authorization detail");
      },
    });
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: "AUTHENTICATION_REQUIRED",
      requestId: expect.any(String),
    });
    expect(res.headers["X-Request-ID"]).toBe(res.body.requestId);
    expect(JSON.stringify(res.body)).not.toContain("sensitive authorization detail");
  });

  it("reports the real question count parsed from the latest analysis", async () => {
    const handler = createProjectsHandler({
      db: {
        project: {
          findMany: vi.fn(async () => [
            {
              id: "p1",
              title: "카카오 기획 지원서",
              company: "카카오",
              jobKeyword: "기획",
              createdAt: new Date("2026-08-20T00:00:00Z"),
              _count: { analyses: 2 },
              analyses: [
                {
                  id: "a1",
                  totalChars: 100,
                  aiResponseJson: null,
                  questionText: "[문항 1] q1\n\n[문항 2] q2\n\n[문항 3] q3",
                },
              ],
            },
          ]),
        },
      },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request(), res);

    expect(res.body[0].analysis_count).toBe(2);
    expect(res.body[0].question_count).toBe(3);
  });

  it("looks up a project by both its ID and the verified user ID", async () => {
    const findFirst = vi.fn(async () => null);
    const handler = createProjectDetailHandler({
      db: { project: { findFirst } },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request({ query: { projectId: "other-users-project" } }), res);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "other-users-project", userId: USER_ID },
    }));
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("returns 404 when deleting a project outside the verified user scope", async () => {
    const deleteMany = vi.fn(async () => ({ count: 0 }));
    const handler = createProjectDetailHandler({
      db: { project: { deleteMany } },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request({ method: "DELETE", query: { projectId: "other-users-project" } }), res);

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "other-users-project", userId: USER_ID },
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("scopes an analysis detail query to the verified user", async () => {
    const findFirst = vi.fn(async () => null);
    const handler = createAnalysisHandler({
      db: { analysis: { findFirst } },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request({ query: { id: "another-users-analysis" } }), res);

    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "another-users-analysis", userId: USER_ID },
    }));
    expect(res.statusCode).toBe(404);
  });

  it("rejects feedback bodies that contain browser-trusted user fields", async () => {
    const upsert = vi.fn();
    const handler = createFeedbackHandler({
      db: { feedback: { upsert } },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request({
      body: {
        analysisId: "analysis-1",
        scores: SURVEY_SCORES,
        comment: SURVEY_COMMENT,
        userId: "attacker-controlled-user",
      },
      method: "POST",
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("INVALID_REQUEST");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns 404 instead of accepting feedback for another user's analysis", async () => {
    const findFirst = vi.fn(async () => null);
    const handler = createFeedbackHandler({
      db: {
        analysis: { findFirst },
        feedback: { upsert: vi.fn() },
      },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request({
      body: {
        analysisId: "another-users-analysis",
        scores: SURVEY_SCORES,
        comment: SURVEY_COMMENT,
      },
      method: "POST",
    }), res);

    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: "another-users-analysis", userId: USER_ID },
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });

  it("stores the survey scores against the verified user, not a client-sent id", async () => {
    const upsert = vi.fn(async () => ({
      id: "feedback-1",
      comment: SURVEY_COMMENT,
      createdAt: "2026-07-23T00:00:00.000Z",
    }));
    const handler = createFeedbackHandler({
      db: {
        analysis: { findFirst: vi.fn(async () => ({ id: "analysis-1" })) },
        // 피드백 저장과 보상 지급은 한 트랜잭션에서 일어난다.
        $transaction: vi.fn(async (fn) => fn({
          feedback: { upsert },
          analysisEntitlement: {
            upsert: vi.fn(async () => ({ userId: USER_ID })),
            findUnique: vi.fn(async () => ({ userId: USER_ID })),
            update: vi.fn(async () => ({ userId: USER_ID })),
          },
          feedbackCreditGrant: {
            findUnique: vi.fn(async () => null),
            create: vi.fn(async () => ({})),
          },
          $queryRaw: vi.fn(async () => []),
        })),
      },
      requireUser: activeUser,
    });
    const res = response();

    await handler(request({
      body: {
        analysisId: "analysis-1",
        scores: SURVEY_SCORES,
        comment: SURVEY_COMMENT,
      },
      method: "POST",
    }), res);

    expect(res.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        comment: SURVEY_COMMENT,
        scoreRecommend: 8,
        userId: USER_ID,
      }),
      update: expect.objectContaining({ comment: SURVEY_COMMENT, scoreRecommend: 8 }),
    }));
  });
});
