import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../lib/auth.js";
import { createProjectsHandler } from "../../api/projects.js";
import { createResponse } from "../helpers/http.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const activeUser = async () => ({ applicationUser: { id: USER_ID, role: "user" } });

function createDb() {
  return {
    $queryRaw: vi.fn(async () => []),
    project: { count: vi.fn(async () => 0), create: vi.fn(async () => ({ id: "p-new" })) },
  };
}

describe("POST /api/projects", () => {
  it("검증된 사용자 소유로 지원서와 문항을 한 번에 만든다", async () => {
    const db = createDb();
    const handler = createProjectsHandler({ db, requireUser: activeUser });
    const res = createResponse();

    await handler({
      method: "POST",
      headers: {},
      body: {
        company: "한솔제지",
        jobKeyword: "국내영업",
        deadline: "2026-10-11T23:59:00+09:00",
        questions: [{ prompt: "지원 동기", charLimit: 700 }],
      },
    }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ id: "p-new" });
    const { data } = db.project.create.mock.calls[0][0];
    expect(data).toMatchObject({
      userId: USER_ID,
      title: "한솔제지 국내영업 지원서",
      company: "한솔제지",
      jobKeyword: "국내영업",
      postingSlug: null,
      questions: { create: [{ position: 1, prompt: "지원 동기", charLimit: 700, answer: "" }] },
    });
    expect(data.deadline.toISOString()).toBe("2026-10-11T14:59:00.000Z");
  });

  it("비로그인은 401 이고 아무것도 만들지 않는다", async () => {
    const db = createDb();
    const handler = createProjectsHandler({
      db,
      requireUser: async () => { throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "x"); },
    });
    const res = createResponse();
    await handler({ method: "POST", headers: {}, body: { company: "A" } }, res);
    expect(res.statusCode).toBe(401);
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it("잘못된 본문은 400, 지원서 200개 이상이면 409", async () => {
    const db = createDb();
    const handler = createProjectsHandler({ db, requireUser: activeUser });
    const bad = createResponse();
    await handler({ method: "POST", headers: {}, body: { company: "" } }, bad);
    expect(bad.statusCode).toBe(400);

    db.project.count.mockResolvedValue(200);
    const full = createResponse();
    await handler({ method: "POST", headers: {}, body: { company: "A" } }, full);
    expect(full.statusCode).toBe(409);
    expect(full.body.error).toBe("PROJECT_LIMIT_REACHED");
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it("PUT 은 405", async () => {
    const handler = createProjectsHandler({ db: createDb(), requireUser: activeUser });
    const res = createResponse();
    await handler({ method: "PUT", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});

describe("GET /api/projects 작업실 필드", () => {
  it("마감·수정 시각·문항 작성 진행을 내려준다", async () => {
    const db = createDb();
    db.$queryRaw.mockResolvedValue([{
      id: "p1", title: "t", company: "A", job_keyword: null, created_at: new Date("2026-10-01T00:00:00Z"),
      analysis_count: 0, latest_id: null, latest_status: null, latest_kind: null, total_chars: null,
      question_text: null, summary: null, keywords: null,
      deadline: new Date("2026-10-11T14:59:00Z"), updated_at: new Date("2026-10-02T00:00:00Z"),
      draft_question_count: 3, answered_count: 1,
    }]);
    const handler = createProjectsHandler({ db, requireUser: activeUser });
    const res = createResponse();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.body[0]).toMatchObject({
      deadline: new Date("2026-10-11T14:59:00Z"),
      updated_at: new Date("2026-10-02T00:00:00Z"),
      draft_question_count: 3,
      answered_count: 1,
    });
    const [strings] = db.$queryRaw.mock.calls[0];
    expect(strings.join("?")).toContain("application_questions");
  });

  it("최근 분석 시각을 latest_analyzed_at 으로 내려준다", async () => {
    const db = createDb();
    const analyzedAt = new Date("2026-10-08T05:00:00Z");
    db.$queryRaw.mockResolvedValue([{
      id: "p1", title: "t", company: "A", job_keyword: null, created_at: new Date("2026-10-01T00:00:00Z"),
      analysis_count: 1, latest_id: "a1", latest_status: "SUCCESS", latest_created_at: analyzedAt, latest_kind: "RESUME",
      total_chars: 900, question_text: null, summary: null, keywords: null,
      deadline: null, updated_at: new Date("2026-10-08T05:00:00Z"), draft_question_count: 1, answered_count: 1,
    }]);
    const res = createResponse();
    await createProjectsHandler({ db, requireUser: activeUser })({ method: "GET", headers: {} }, res);
    expect(res.body[0].latest_analyzed_at).toEqual(analyzedAt);
  });
});
