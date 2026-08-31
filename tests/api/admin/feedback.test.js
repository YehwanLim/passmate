import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    feedback: { count: vi.fn(), findMany: vi.fn() },
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));

vi.mock("../../../lib/prisma.js", () => ({
  default: mocks.prisma,
}));

const { default: feedbackHandler } = await import(
  "../../../lib/admin-handlers/feedback.js"
);

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
    res
  );
  return res;
}

const ROW = {
  id: "feedback-1",
  analysisId: "analysis-1",
  rating: "THUMBS_DOWN",
  comment: "리포트가 제 문항이랑 안 맞아요",
  createdAt: new Date("2026-08-30T02:00:00.000Z"),
  user: { email: "seeker@example.com", name: "지원자" },
  analysis: {
    questionText: "지원 동기를 서술하시오",
    modelName: "gemini-test",
    createdAt: new Date("2026-08-30T01:00:00.000Z"),
    project: { company: "카카오", jobKeyword: "백엔드" },
  },
};

/** 핸들러는 $transaction 에 [count, up, down, withComment, rows] 순으로 넘긴다. */
function resolveTransaction({ total = 1, rows = [ROW] } = {}) {
  mocks.prisma.$transaction.mockResolvedValue([total, 7, 3, 4, rows]);
}

describe("admin feedback handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({
      applicationUser: { id: "admin-1", role: "admin" },
    });
  });

  it("requires an administrator before reading any feedback", async () => {
    mocks.requireAdministrator.mockRejectedValue(
      Object.assign(new Error("authentication internals"), { statusCode: 401 })
    );

    const res = await invoke();

    expect(res.statusCode).toBe(401);
    expect(mocks.prisma.feedback.findMany).not.toHaveBeenCalled();
    // 인증 실패 응답이 내부 오류 문구를 새어 나가게 하지 않는다.
    expect(JSON.stringify(res.body)).not.toContain("authentication internals");
  });

  it("rejects non-GET methods", async () => {
    const res = await invoke({ method: "DELETE" });

    expect(res.statusCode).toBe(405);
    expect(mocks.prisma.feedback.findMany).not.toHaveBeenCalled();
  });

  it("returns the feedback list with summary counts", async () => {
    resolveTransaction({ total: 12 });

    const res = await invoke();

    expect(res.statusCode).toBe(200);
    expect(res.body.total).toBe(12);
    expect(res.body.summary).toEqual({
      thumbsUp: 7,
      thumbsDown: 3,
      withComment: 4,
    });
    expect(res.body.items).toEqual([
      {
        id: "feedback-1",
        analysisId: "analysis-1",
        rating: "THUMBS_DOWN",
        comment: "리포트가 제 문항이랑 안 맞아요",
        createdAt: ROW.createdAt,
        userEmail: "seeker@example.com",
        userName: "지원자",
        company: "카카오",
        jobKeyword: "백엔드",
        questionText: "지원 동기를 서술하시오",
        modelName: "gemini-test",
        analyzedAt: ROW.analysis.createdAt,
      },
    ]);
  });

  it("keeps rows readable when the linked analysis or user is missing", async () => {
    resolveTransaction({
      rows: [{ ...ROW, comment: null, user: null, analysis: null }],
    });

    const res = await invoke();

    expect(res.body.items[0]).toMatchObject({
      comment: null,
      userEmail: null,
      userName: null,
      company: null,
      jobKeyword: null,
      questionText: null,
      modelName: null,
      analyzedAt: null,
    });
  });

  it("filters by rating and comment presence", async () => {
    resolveTransaction();

    await invoke({ query: { rating: "THUMBS_DOWN", commentsOnly: "true" } });

    const [{ where }] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(where.rating).toBe("THUMBS_DOWN");
    expect(where.AND).toEqual([
      { comment: { not: null } },
      { comment: { not: "" } },
    ]);
  });

  it("ignores an unknown rating filter instead of passing it to the database", async () => {
    resolveTransaction();

    await invoke({ query: { rating: "SOMETHING_ELSE" } });

    const [{ where }] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(where.rating).toBeUndefined();
  });

  it("searches across comment, user and company", async () => {
    resolveTransaction();

    await invoke({ query: { search: "  카카오  " } });

    const [{ where }] = mocks.prisma.feedback.findMany.mock.calls[0];
    expect(where.OR).toEqual([
      { comment: { contains: "카카오", mode: "insensitive" } },
      { user: { email: { contains: "카카오", mode: "insensitive" } } },
      { user: { name: { contains: "카카오", mode: "insensitive" } } },
      {
        analysis: {
          project: { company: { contains: "카카오", mode: "insensitive" } },
        },
      },
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
