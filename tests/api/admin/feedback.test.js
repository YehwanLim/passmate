import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    feedback: { aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: feedbackHandler } = await import("../../../lib/admin-handlers/feedback.js");

function response() {
  return {
    body: undefined,
    statusCode: 200,
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

async function invoke({ method = "GET", query = {} } = {}) {
  const res = response();
  await feedbackHandler(
    {
      headers: { authorization: "Bearer test-token" },
      method,
      query,
      url: "/api/admin/feedback",
    },
    res,
  );
  return res;
}

const SURVEY_ROW = {
  id: "feedback-1",
  analysisId: "analysis-1",
  rating: null,
  comment: "문항별 지적이 제 자소서와 잘 안 맞았어요",
  createdAt: new Date("2026-08-31T02:00:00.000Z"),
  scoreReflection: 6,
  scoreImprovement: 5,
  scoreRecommend: 4,
  user: { email: "seeker@example.com", name: "지원자" },
  analysis: {
    questionText: "지원 동기를 서술하시오",
    modelName: "gemini-test",
    createdAt: new Date("2026-08-31T01:00:00.000Z"),
    project: { company: "카카오", jobKeyword: "백엔드" },
  },
};

/** 핸들러는 $transaction 에 [total, surveyCount, withComment, averages, rows] 순으로 넘긴다. */
function resolveTransaction({ total = 1, rows = [SURVEY_ROW], averages } = {}) {
  mocks.prisma.$transaction.mockResolvedValue([
    total,
    9,
    7,
    averages ?? {
      _avg: {
        scoreReflection: 6.44,
        scoreImprovement: 5.25,
        scoreRecommend: 4.5,
      },
    },
    rows,
  ]);
}

describe("admin feedback handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({
      applicationUser: { id: "admin-1", role: "admin" },
    });
  });

  it("requires an administrator before reading any response", async () => {
    mocks.requireAdministrator.mockRejectedValue(
      Object.assign(new Error("authentication internals"), { statusCode: 401 }),
    );

    const res = await invoke();

    expect(res.statusCode).toBe(401);
    expect(mocks.prisma.feedback.findMany).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain("authentication internals");
  });

  it("rejects non-GET methods", async () => {
    const res = await invoke({ method: "DELETE" });

    expect(res.statusCode).toBe(405);
    expect(mocks.prisma.feedback.findMany).not.toHaveBeenCalled();
  });

  it("returns per-question scores and the row average", async () => {
    resolveTransaction({ total: 12 });

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.items[0]).toMatchObject({
      id: "feedback-1",
      analysisId: "analysis-1",
      scores: {
        reflection: 6,
        improvement: 5,
        recommend: 4,
      },
      averageScore: 5,
      legacyRating: null,
      userEmail: "seeker@example.com",
      company: "카카오",
    });
  });

  it("rounds the question averages to one decimal", async () => {
    resolveTransaction();

    const res = await invoke();

    expect(res.body.summary).toMatchObject({
      surveyCount: 9,
      withComment: 7,
      questionAverages: {
        reflection: 6.4,
        improvement: 5.3,
        recommend: 4.5,
      },
    });
  });

  it("keeps legacy thumbs rows readable instead of scoring them zero", async () => {
    resolveTransaction({
      rows: [
        {
          ...SURVEY_ROW,
          rating: "THUMBS_DOWN",
          scoreReflection: null,
          scoreImprovement: null,
          scoreRecommend: null,
        },
      ],
    });

    const res = await invoke();

    expect(res.body.items[0].averageScore).toBeNull();
    expect(res.body.items[0].legacyRating).toBe("THUMBS_DOWN");
    expect(Object.values(res.body.items[0].scores)).toEqual([null, null, null]);
  });

  it("keeps rows readable when the linked analysis or user is missing", async () => {
    resolveTransaction({ rows: [{ ...SURVEY_ROW, user: null, analysis: null }] });

    const res = await invoke();

    expect(res.body.items[0]).toMatchObject({
      userEmail: null,
      userName: null,
      company: null,
      jobKeyword: null,
      questionText: null,
      modelName: null,
      analyzedAt: null,
    });
  });

  it("segments by recommendation score", async () => {
    resolveTransaction();
    await invoke({ query: { segment: "DETRACTOR" } });
    expect(mocks.prisma.feedback.findMany.mock.calls[0][0].where.scoreRecommend)
      .toEqual({ lte: 6 });

    mocks.prisma.feedback.findMany.mockClear();
    resolveTransaction();
    await invoke({ query: { segment: "PROMOTER" } });
    expect(mocks.prisma.feedback.findMany.mock.calls[0][0].where.scoreRecommend)
      .toEqual({ gte: 9 });

    mocks.prisma.feedback.findMany.mockClear();
    resolveTransaction();
    await invoke({ query: { segment: "LEGACY" } });
    const legacyWhere = mocks.prisma.feedback.findMany.mock.calls[0][0].where;
    expect(legacyWhere.scoreRecommend).toBeNull();
    expect(legacyWhere.rating).toEqual({ not: null });
  });

  it("ignores an unknown segment instead of passing it to the database", async () => {
    resolveTransaction();

    await invoke({ query: { segment: "SOMETHING_ELSE" } });

    const [{ where }] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(where.scoreRecommend).toBeUndefined();
    expect(where.rating).toBeUndefined();
  });

  it("filters to rows that carry a written answer", async () => {
    resolveTransaction();

    await invoke({ query: { commentsOnly: "true" } });

    const [{ where }] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(where.AND).toEqual([{ comment: { not: null } }, { comment: { not: "" } }]);
  });

  it("searches across the written answer, user and company", async () => {
    resolveTransaction();

    await invoke({ query: { search: "  카카오  " } });

    const [{ where }] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(where.OR).toEqual([
      { comment: { contains: "카카오", mode: "insensitive" } },
      { user: { email: { contains: "카카오", mode: "insensitive" } } },
      { user: { name: { contains: "카카오", mode: "insensitive" } } },
      { analysis: { project: { company: { contains: "카카오", mode: "insensitive" } } } },
    ]);
  });

  it("clamps pagination input coming from the query string", async () => {
    resolveTransaction();

    await invoke({ query: { page: "3", pageSize: "9999" } });

    const [args] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(args.take).toBe(100);
    expect(args.skip).toBe(200);

    mocks.prisma.feedback.findMany.mockClear();
    resolveTransaction();
    await invoke({ query: { page: "-4", pageSize: "not-a-number" } });

    const [fallback] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(fallback.take).toBe(15);
    expect(fallback.skip).toBe(0);
  });
});
