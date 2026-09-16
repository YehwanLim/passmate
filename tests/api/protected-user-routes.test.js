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

  // 목록 핸들러는 raw SQL 한 번으로 프로젝트 + 최신 analysis 의 필요한 필드만 읽는다. 행 모양은 SQL 별칭 그대로.
  function projectRow(overrides = {}) {
    return {
      id: "p1",
      title: "카카오 기획 지원서",
      company: "카카오",
      job_keyword: "기획",
      created_at: new Date("2026-08-20T00:00:00Z"),
      analysis_count: 1,
      latest_id: "a1",
      latest_status: "SUCCESS",
      latest_kind: "RESUME",
      total_chars: 100,
      question_text: "[문항 1] q1",
      summary: null,
      keywords: null,
      ...overrides,
    };
  }

  function projectsHandlerFor(rows) {
    const $queryRaw = vi.fn(async () => rows);
    return { handler: createProjectsHandler({ db: { $queryRaw }, requireUser: activeUser }), $queryRaw };
  }

  it("scopes the project list query to the verified user", async () => {
    const { handler, $queryRaw } = projectsHandlerFor([]);
    const res = response();

    await handler(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
    // 태그드 템플릿 호출: 첫 인자는 SQL 조각, 그 뒤가 바인딩 값. 유일한 바인딩이 검증된 사용자 ID여야 한다.
    const [strings, ...values] = $queryRaw.mock.calls[0];
    expect(strings.join("?")).toMatch(/WHERE p\.user_id = \?::uuid/);
    expect(values).toEqual([USER_ID]);
  });

  it("reports the real question count parsed from the latest analysis", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({ analysis_count: 2, question_text: "[문항 1] q1\n\n[문항 2] q2\n\n[문항 3] q3" }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0].analysis_count).toBe(2);
    expect(res.body[0].question_count).toBe(3);
    expect(res.body[0].kind).toBe("RESUME");
  });

  it("labels a company analysis project and summarizes it from the brief", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({
        id: "p2",
        title: "현대자동차 전략기획 기업 분석",
        company: "현대자동차",
        job_keyword: "전략기획",
        latest_id: "a2",
        latest_kind: "COMPANY",
        total_chars: null,
        question_text: "",
        summary: "전동화로 체급을 바꾸는 완성차",
      }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0]).toMatchObject({
      kind: "COMPANY",
      question_count: 0,
      total_chars: 0,
      summary: "전동화로 체급을 바꾸는 완성차",
    });
  });

  it("returns the latest analysis status and normalized résumé hashtags as keywords", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({
        id: "p3",
        title: "네이버 마케팅 지원서",
        company: "네이버",
        job_keyword: "마케팅",
        latest_id: "a3",
        total_chars: 1200,
        summary: "숫자가 붙는 자소서",
        keywords: ["#커머스 리텐션", "# 커머스 리텐션", "#퍼널 실험", "", "#CRM", "#데이터", "#고객", "#7번째"],
      }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0].latest_status).toBe("SUCCESS");
    expect(res.body[0].keywords).toEqual(["커머스 리텐션", "퍼널 실험", "CRM", "데이터", "고객", "7번째"]);
  });

  it("strips markdown emphasis the model sometimes wraps around the one-liner and hashtags", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({
        id: "p3b",
        title: "아티언스 서비스기획 지원서",
        company: "아티언스",
        job_keyword: "서비스기획",
        latest_id: "a3b",
        total_chars: 1200,
        summary: "**이탈 데이터를 파고든 경험은 강력하나, AI 서비스 맥락과 연결되지 않습니다.**",
        keywords: ["**#유저행동데이터**", "#실험기반개선"],
      }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0].summary).toBe("이탈 데이터를 파고든 경험은 강력하나, AI 서비스 맥락과 연결되지 않습니다.");
    expect(res.body[0].keywords).toEqual(["유저행동데이터", "실험기반개선"]);
  });

  it("drops non-string and duplicate company keywords", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({
        id: "p4",
        latest_id: "a4",
        latest_kind: "COMPANY",
        total_chars: null,
        question_text: "",
        summary: "전동화",
        keywords: ["전동화", "SDV", 42, "전동화"],
      }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0].keywords).toEqual(["전동화", "SDV"]);
  });

  it("reports a pending analysis with an empty keyword list instead of failing", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({ id: "p5", latest_id: "a5", latest_status: "PENDING", total_chars: 900 }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0]).toMatchObject({ latest_status: "PENDING", keywords: [], summary: null });
  });

  it("returns a project that has no analysis yet with null latest fields", async () => {
    const { handler } = projectsHandlerFor([
      projectRow({
        analysis_count: 0,
        latest_id: null,
        latest_status: null,
        latest_kind: null,
        total_chars: null,
        question_text: null,
      }),
    ]);
    const res = response();

    await handler(request(), res);

    expect(res.body[0]).toMatchObject({
      analysis_count: 0,
      kind: "RESUME",
      question_count: 0,
      latest_analysis_id: null,
      latest_status: null,
      total_chars: 0,
      summary: null,
      keywords: [],
    });
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
