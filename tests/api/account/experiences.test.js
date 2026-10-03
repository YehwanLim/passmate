import { describe, expect, it, vi } from "vitest";
import { AuthorizationError } from "../../../lib/auth.js";
import { ApiError } from "../../../lib/api-handler.js";
import {
  createExperienceDetailHandler,
  createExperiencesHandler,
  normalizeExperience,
} from "../../../lib/experiences.js";
import { createAccountRoutesHandler } from "../../../api/account/[...route].js";
import { createResponse } from "../../helpers/http.js";

const USER = { applicationUser: { id: "11111111-1111-4111-8111-111111111111", role: "user" } };
const EXP_ID = "44444444-4444-4444-8444-444444444444";
const ROW = {
  id: EXP_ID, title: "카페 발주 개선", period: "2025.03-2025.08", situation: "폐기 많음",
  action: "판매 데이터로 발주량 조정", result: "폐기 30% 감소", tags: ["데이터", "실행력"],
  updatedAt: new Date("2026-10-03T00:00:00Z"),
};

function createDb() {
  return {
    experience: {
      findMany: vi.fn(async () => [ROW]),
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }) => ({ ...ROW, ...data })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () => ROW),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
}

describe("normalizeExperience", () => {
  it("제목은 필수, 태그는 다듬고 중복을 지운다", () => {
    expect(normalizeExperience({ title: " 발주 개선 ", tags: [" 데이터", "데이터", "실행력"] }, { partial: false }))
      .toEqual({ title: "발주 개선", period: null, situation: "", action: "", result: "", tags: ["데이터", "실행력"] });
    expect(() => normalizeExperience({}, { partial: false })).toThrow(ApiError);
  });

  it("너무 긴 본문, 태그 6개, 모르는 키는 400", () => {
    for (const bad of [
      { title: "t", situation: "가".repeat(1501) },
      { title: "t", tags: ["a", "b", "c", "d", "e", "f"] },
      { title: "t", owner: "x" },
    ]) {
      expect(() => normalizeExperience(bad, { partial: false })).toThrow(ApiError);
    }
  });

  it("partial 은 보낸 키만 돌려주되 빈 본문은 400", () => {
    expect(normalizeExperience({ result: "늘었다" }, { partial: true })).toEqual({ result: "늘었다" });
    expect(() => normalizeExperience({}, { partial: true })).toThrow(ApiError);
  });
});

describe("GET·POST /api/account/experiences", () => {
  it("내 경험만 최근 수정순으로 준다", async () => {
    const db = createDb();
    const res = createResponse();
    await createExperiencesHandler({ db, requireUser: async () => USER })({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.experiences).toHaveLength(1);
    expect(db.experience.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER.applicationUser.id },
      orderBy: { updatedAt: "desc" },
    }));
  });

  it("비로그인은 401", async () => {
    const res = createResponse();
    await createExperiencesHandler({
      db: createDb(),
      requireUser: async () => { throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "x"); },
    })({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(401);
  });

  it("만들기는 내 소유로, 100개가 차면 409", async () => {
    const db = createDb();
    const handler = createExperiencesHandler({ db, requireUser: async () => USER });
    const created = createResponse();
    await handler({ method: "POST", headers: {}, body: { title: "발주 개선" } }, created);
    expect(created.statusCode).toBe(201);
    expect(db.experience.create.mock.calls[0][0].data.userId).toBe(USER.applicationUser.id);

    db.experience.count.mockResolvedValue(100);
    const full = createResponse();
    await handler({ method: "POST", headers: {}, body: { title: "x" } }, full);
    expect(full.statusCode).toBe(409);
    expect(full.body.error).toBe("EXPERIENCE_LIMIT_REACHED");
  });
});

describe("PATCH·DELETE /api/account/experiences/:id", () => {
  it("남의 경험은 404", async () => {
    const db = createDb();
    db.experience.updateMany.mockResolvedValue({ count: 0 });
    const res = createResponse();
    await createExperienceDetailHandler({ db, requireUser: async () => USER })(
      { method: "PATCH", headers: {}, query: { experienceId: EXP_ID }, body: { title: "x" } }, res);
    expect(res.statusCode).toBe(404);
    expect(db.experience.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: EXP_ID, userId: USER.applicationUser.id },
    }));
  });

  it("삭제는 204", async () => {
    const db = createDb();
    const res = createResponse();
    await createExperienceDetailHandler({ db, requireUser: async () => USER })(
      { method: "DELETE", headers: {}, query: { experienceId: EXP_ID } }, res);
    expect(res.statusCode).toBe(204);
  });
});

describe("계정 라우터 분기", () => {
  it("experiences, experiences/:id 를 각 핸들러로 보낸다", async () => {
    const experiencesHandler = vi.fn();
    const experienceDetailHandler = vi.fn();
    const router = createAccountRoutesHandler({ experiencesHandler, experienceDetailHandler });
    await router({ method: "GET", headers: {}, query: { route: ["experiences"] } }, createResponse());
    await router({ method: "DELETE", headers: {}, query: { route: ["experiences", EXP_ID] } }, createResponse());
    expect(experiencesHandler).toHaveBeenCalledTimes(1);
    expect(experienceDetailHandler).toHaveBeenCalledTimes(1);
  });
});
