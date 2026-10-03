import { describe, expect, it, vi } from "vitest";
import { createProjectDetailHandler } from "../../api/projects/[projectId]/index.js";
import { createResponse } from "../helpers/http.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const activeUser = async () => ({ applicationUser: { id: USER_ID, role: "user" } });
const T1 = new Date("2026-10-03T01:00:00.000Z");
const T2 = new Date("2026-10-03T02:00:00.000Z");

function projectRecord(overrides = {}) {
  return {
    id: PROJECT_ID, title: "A 지원서", company: "A", jobKeyword: null, createdAt: T1,
    deadline: null, postingSlug: null,
    _count: { analyses: 0 },
    analyses: [],
    questions: [],
    ...overrides,
  };
}

function createDb(project = projectRecord()) {
  const db = {
    project: {
      findFirst: vi.fn(async ({ where }) => (where.userId === USER_ID ? project : null)),
      update: vi.fn(async ({ data }) => ({ ...project, ...data })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    applicationQuestion: {
      aggregate: vi.fn(async () => ({ _max: { updatedAt: T1 } })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  db.$transaction = vi.fn(async (work) => work(db));
  return db;
}

const req = (overrides) => ({ headers: {}, query: { projectId: PROJECT_ID }, ...overrides });

describe("GET /api/projects/:id 작업실", () => {
  it("문항·마감·최신 분석 id 를 내려준다", async () => {
    const db = createDb(projectRecord({
      deadline: T2,
      analyses: [{ id: "a1", totalChars: 300, aiResponseJson: null }],
      questions: [{ position: 1, prompt: "지원 동기", charLimit: 700, answer: "안녕", updatedAt: T1 }],
    }));
    const res = createResponse();
    await createProjectDetailHandler({ db, requireUser: activeUser })(req({ method: "GET" }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      deadline: T2,
      posting_slug: null,
      latest_analysis_id: "a1",
      questions: [{ position: 1, prompt: "지원 동기", char_limit: 700, answer: "안녕" }],
      questions_updated_at: T1,
    });
  });
});

describe("PATCH /api/projects/:id", () => {
  it("회사가 바뀌면 제목도 다시 만든다", async () => {
    const db = createDb();
    const res = createResponse();
    await createProjectDetailHandler({ db, requireUser: activeUser })(
      req({ method: "PATCH", body: { company: "B", jobKeyword: "영업" } }), res);
    expect(res.statusCode).toBe(200);
    expect(db.project.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: PROJECT_ID },
      data: { company: "B", jobKeyword: "영업", title: "B 영업 지원서" },
    }));
  });

  it("남의 지원서는 404 이고 고치지 않는다", async () => {
    const db = createDb();
    const res = createResponse();
    await createProjectDetailHandler({
      db, requireUser: async () => ({ applicationUser: { id: "intruder", role: "user" } }),
    })(req({ method: "PATCH", body: { deadline: null } }), res);
    expect(res.statusCode).toBe(404);
    expect(db.project.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/projects/:id (문항 저장)", () => {
  const body = { questions: [{ prompt: "지원 동기", answer: "초안" }], baseUpdatedAt: T1.toISOString() };

  it("문항을 통째로 갈아끼우고 새 시각을 돌려준다", async () => {
    const db = createDb();
    db.applicationQuestion.aggregate
      .mockResolvedValueOnce({ _max: { updatedAt: T1 } })
      .mockResolvedValueOnce({ _max: { updatedAt: T2 } });
    const res = createResponse();
    await createProjectDetailHandler({ db, requireUser: activeUser })(req({ method: "PUT", body }), res);
    expect(res.statusCode).toBe(200);
    expect(db.applicationQuestion.deleteMany).toHaveBeenCalledWith({ where: { projectId: PROJECT_ID } });
    expect(db.applicationQuestion.createMany).toHaveBeenCalledWith({
      data: [{ projectId: PROJECT_ID, position: 1, prompt: "지원 동기", charLimit: null, answer: "초안" }],
    });
    // 목록의 "최근 수정" 정렬이 projects.updated_at 이라, 저장할 때 지원서 행도 건드린다.
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: PROJECT_ID },
      data: { updatedAt: expect.any(Date) },
    });
    expect(res.body).toEqual({ questions_updated_at: T2 });
  });

  it("다른 탭이 더 최근에 저장했으면 409 STALE_DRAFT 이고 덮어쓰지 않는다", async () => {
    const db = createDb();
    db.applicationQuestion.aggregate.mockResolvedValue({ _max: { updatedAt: T2 } });
    const res = createResponse();
    await createProjectDetailHandler({ db, requireUser: activeUser })(req({ method: "PUT", body }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("STALE_DRAFT");
    expect(db.applicationQuestion.deleteMany).not.toHaveBeenCalled();
    expect(db.project.update).not.toHaveBeenCalled();
  });

  it("남의 지원서는 404", async () => {
    const db = createDb();
    const res = createResponse();
    await createProjectDetailHandler({
      db, requireUser: async () => ({ applicationUser: { id: "intruder", role: "user" } }),
    })(req({ method: "PUT", body }), res);
    expect(res.statusCode).toBe(404);
    expect(db.applicationQuestion.createMany).not.toHaveBeenCalled();
  });
});
