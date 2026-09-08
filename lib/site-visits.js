import { ApiError, sendJson, withApiHandler } from "./api-handler.js";
import { requireAuthenticatedUser } from "./auth.js";
import prisma from "./prisma.js";

export const VISIT_PATH_MAX_LENGTH = 200;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/**
 * 방문 핑은 로그인 없이 누구나 보내므로 받는 값을 좁게 제한한다. 경로는 쿼리·해시를
 * 뺀 pathname 만 받고, 관리자 화면은 운영자 자신의 이동이라 방문으로 세지 않는다.
 */
export function readVisitBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!Object.keys(body).every((key) => ["visitorId", "path"].includes(key))) return null;

  const { visitorId, path } = body;
  if (typeof visitorId !== "string" || !VISITOR_ID_PATTERN.test(visitorId)) return null;
  if (typeof path !== "string" || !path.startsWith("/") || path.length > VISIT_PATH_MAX_LENGTH) return null;
  if (/[?#\s]/.test(path)) return null;
  if (path === "/admin" || path.startsWith("/admin/")) return null;

  return { visitorId, path };
}

/**
 * 로그인 여부는 있으면 붙이고 없으면 익명으로 남긴다. 토큰이 만료됐거나 앱 계정이
 * 아직 없어도 방문 자체는 기록해야 하므로 인증 실패는 에러가 아니라 null 이다.
 */
async function resolveUserId(req, db, authenticate) {
  try {
    const authenticated = await authenticate(req);
    if (!authenticated?.id) return null;
    const user = await db.user.findUnique({ where: { id: authenticated.id }, select: { id: true } });
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export function createSiteVisitHandler({ db = prisma, authenticate = requireAuthenticatedUser } = {}) {
  return async function siteVisitHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);

      const visit = readVisitBody(req.body);
      if (!visit) throw new ApiError("INVALID_REQUEST", 400);

      const userId = await resolveUserId(req, db, authenticate);
      await db.siteVisit.create({
        data: { visitorId: visit.visitorId, path: visit.path, userId },
        select: { id: true },
      });

      return sendJson(res, 200, { recorded: true }, requestId);
    });
  };
}
