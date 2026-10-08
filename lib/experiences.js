import { ApiError, sendJson, withApiHandler } from "./api-handler.js";
import { requireActiveApplicationUser } from "./auth.js";
import prisma from "./prisma.js";
import { isRecord, sanitizeInput } from "./sanitize.js";

// 내 경험(경험 금고) — 사용자가 직접 입력하는 경험 카드. 본문은 자소서 소재라 로그·감사 이벤트에 남기지 않는다.
// body 는 자유 양식 글(칸 셋을 합친 만큼 받는다). 비어 있으면 칸(상황·한 일·결과)으로 쓴 경험이다.
export const EXPERIENCE_LIMITS = Object.freeze({ title: 100, period: 50, text: 1500, body: 4500, tags: 5, tagChars: 20, perUser: 100 });
const TEXT_FIELDS = ["situation", "action", "result"];
const SELECT = { id: true, title: true, period: true, situation: true, action: true, result: true, body: true, tags: true, updatedAt: true };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BATCH = 8; // 경험 자동 채우기 후보 상한과 같다

function invalid() {
  return new ApiError("INVALID_REQUEST", 400);
}

function text(value, max) {
  if (typeof value !== "string" || value.length > max) throw invalid();
  return sanitizeInput(value);
}

function tagsOf(value) {
  if (!Array.isArray(value) || value.length > EXPERIENCE_LIMITS.tags) throw invalid();
  const cleaned = value.map((tag) => text(tag, EXPERIENCE_LIMITS.tagChars)).filter((tag) => tag.length > 0);
  return Array.from(new Set(cleaned));
}

export function normalizeExperience(body, { partial }) {
  if (!isRecord(body)) throw invalid();
  const allowed = new Set(["title", "period", ...TEXT_FIELDS, "body", "tags"]);
  if (!Object.keys(body).every((key) => allowed.has(key))) throw invalid();
  if (partial && Object.keys(body).length === 0) throw invalid();

  const data = {};
  if (!partial || "title" in body) {
    const title = text(body.title, EXPERIENCE_LIMITS.title);
    if (title.length === 0) throw invalid();
    data.title = title;
  }
  if (!partial || "period" in body) {
    const period = body.period === undefined || body.period === null ? "" : text(body.period, EXPERIENCE_LIMITS.period);
    data.period = period.length > 0 ? period : null;
  }
  for (const field of TEXT_FIELDS) {
    if (!partial || field in body) data[field] = body[field] === undefined ? "" : text(body[field], EXPERIENCE_LIMITS.text);
  }
  if (!partial || "body" in body) data.body = body.body === undefined ? "" : text(body.body, EXPERIENCE_LIMITS.body);
  if (!partial || "tags" in body) data.tags = body.tags === undefined ? [] : tagsOf(body.tags);
  return data;
}

// 계정 라우터가 경로의 두 번째 조각을 req.query.experienceId 로 넘긴다(배포·로컬 경로 모두 같은 값).
function experienceIdOf(req) {
  const id = req.query?.experienceId;
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw invalid();
  return id;
}

export function createExperiencesHandler({
  db = prisma,
  requireUser = (req) => requireActiveApplicationUser(req, db),
} = {}) {
  return async function experiencesHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET" && req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);
      const { applicationUser } = await requireUser(req);
      const userId = applicationUser.id;

      if (req.method === "GET") {
        const experiences = await db.experience.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: SELECT,
        });
        return sendJson(res, 200, { experiences }, requestId);
      }

      // 경험 자동 채우기: 고른 후보를 한꺼번에. 전부 들어가거나 하나도 안 들어간다.
      if (isRecord(req.body) && "experiences" in req.body) {
        const list = req.body.experiences;
        if (Object.keys(req.body).length !== 1 || !Array.isArray(list) || list.length === 0 || list.length > MAX_BATCH) {
          throw invalid();
        }
        const items = list.map((item) => normalizeExperience(item, { partial: false }));
        const owned = await db.experience.count({ where: { userId } });
        if (owned + items.length > EXPERIENCE_LIMITS.perUser) throw new ApiError("EXPERIENCE_LIMIT_REACHED", 409);
        const experiences = await db.$transaction(
          items.map((data) => db.experience.create({ data: { ...data, userId }, select: SELECT })),
        );
        return sendJson(res, 201, { experiences }, requestId);
      }

      const data = normalizeExperience(req.body, { partial: false });
      const owned = await db.experience.count({ where: { userId } });
      if (owned >= EXPERIENCE_LIMITS.perUser) throw new ApiError("EXPERIENCE_LIMIT_REACHED", 409);
      const experience = await db.experience.create({ data: { ...data, userId }, select: SELECT });
      return sendJson(res, 201, { experience }, requestId);
    });
  };
}

export function createExperienceDetailHandler({
  db = prisma,
  requireUser = (req) => requireActiveApplicationUser(req, db),
} = {}) {
  return async function experienceDetailHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "PATCH" && req.method !== "DELETE") throw new ApiError("METHOD_NOT_ALLOWED", 405);
      const id = experienceIdOf(req);
      const { applicationUser } = await requireUser(req);
      const where = { id, userId: applicationUser.id };

      if (req.method === "DELETE") {
        const deleted = await db.experience.deleteMany({ where });
        if (deleted.count === 0) throw new ApiError("NOT_FOUND", 404);
        return res.status(204).end();
      }

      const data = normalizeExperience(req.body, { partial: true });
      const updated = await db.experience.updateMany({ where, data });
      if (updated.count === 0) throw new ApiError("NOT_FOUND", 404);
      const experience = await db.experience.findFirst({ where, select: SELECT });
      return sendJson(res, 200, { experience }, requestId);
    });
  };
}
