import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../lib/auth.js";
import { createProjectsHandler } from "../../api/projects.js";
import { createResponse } from "../helpers/http.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const activeUser = async () => ({ applicationUser: { id: USER_ID, role: "user" } });

function createDb() {
  return {
    $queryRaw: vi.fn(async () => []),
    project: {
      count: vi.fn(async () => 0),
      create: vi.fn(async () => ({ id: "p-new" })),
      findFirst: vi.fn(async () => null),
    },
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

  it("담기(stage interest)는 관심 단계 지원서를 공고와 함께 만든다", async () => {
    const db = createDb();
    const res = createResponse();
    await createProjectsHandler({ db, requireUser: activeUser })({
      method: "POST", headers: {},
      body: { company: "현대자동차", deadline: "2026-11-20T17:00:00+09:00", postingSlug: "hyundai-2026h2", stage: "interest", questions: [] },
    }, res);
    expect(res.statusCode).toBe(201);
    expect(db.project.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, postingSlug: "hyundai-2026h2" },
      select: { id: true },
    });
    expect(db.project.create.mock.calls[0][0].data).toMatchObject({ stage: "interest", postingSlug: "hyundai-2026h2" });
  });

  it("같은 공고를 다시 담으면 새로 만들지 않고 200 existing", async () => {
    const db = createDb();
    db.project.findFirst.mockResolvedValue({ id: "p-old" });
    const res = createResponse();
    await createProjectsHandler({ db, requireUser: activeUser })({
      method: "POST", headers: {},
      body: { company: "현대자동차", postingSlug: "hyundai-2026h2", stage: "interest", questions: [] },
    }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: "p-old", existing: true });
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it("stage 를 안 보내면 기본값(DB writing)에 맡기고 중복 검사도 하지 않는다", async () => {
    const db = createDb();
    const res = createResponse();
    await createProjectsHandler({ db, requireUser: activeUser })({
      method: "POST", headers: {}, body: { company: "A", postingSlug: "a-2026", questions: [] },
    }, res);
    expect(res.statusCode).toBe(201);
    expect(db.project.findFirst).not.toHaveBeenCalled();
    expect(db.project.create.mock.calls[0][0].data).not.toHaveProperty("stage");
  });

  it("interest 가 아닌 stage 는 400", async () => {
    const db = createDb();
    const res = createResponse();
    await createProjectsHandler({ db, requireUser: activeUser })({
      method: "POST", headers: {}, body: { company: "A", stage: "offer" },
    }, res);
    expect(res.statusCode).toBe(400);
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
  it("현황판 필드(stage·stage_steps·rejected·posting_slug)를 내려주고, 비어 있으면 기본값", async () => {
    const db = createDb();
    const steps = [{ key: "interest" }, { key: "writing" }, { key: "submitted" }, { key: "c_k3m9x2ab", label: "인적성" }, { key: "doc_passed" }, { key: "interview" }, { key: "offer" }];
    db.$queryRaw.mockResolvedValue([
      { id: "p1", title: "t", company: "A", created_at: new Date(), analysis_count: 0, stage: "submitted", stage_steps: steps, rejected: true, posting_slug: "a-2026" },
      { id: "p2", title: "t", company: "B", created_at: new Date(), analysis_count: 0 },
    ]);
    const res = createResponse();
    await createProjectsHandler({ db, requireUser: activeUser })({ method: "GET", headers: {} }, res);
    expect(res.body[0]).toMatchObject({ stage: "submitted", stage_steps: steps, rejected: true, posting_slug: "a-2026" });
    expect(res.body[1]).toMatchObject({ stage: "writing", stage_steps: null, rejected: false, posting_slug: null });
    const [strings] = db.$queryRaw.mock.calls[0];
    expect(strings.join("?")).toContain("p.stage_steps");
  });
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
