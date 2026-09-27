import { ApiError, sendJson, withApiHandler } from "./api-handler.js";
import { requireAuthenticatedUser } from "./auth.js";
import prisma from "./prisma.js";

export const VISIT_PATH_MAX_LENGTH = 200;
export const VISIT_REFERRER_MAX_LENGTH = 200;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const UTM_SOURCE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
const ALLOWED_KEYS = ["visitorId", "path", "referrer", "utmSource"];

/**
 * referrer 는 외부 페이지 주소만 남긴다(origin + pathname). 쿼리·해시는 개인 식별 값이 섞일 수
 * 있어 버리고, http(s) 가 아니거나 파싱이 안 되면 없는 것으로 친다. 잘못된 값 때문에 방문
 * 자체를 거절하지는 않는다 — 집계는 부가 기능이다.
 */
export function normalizeReferrer(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return `${url.origin}${url.pathname}`.slice(0, VISIT_REFERRER_MAX_LENGTH);
}

/**
 * 방문 핑은 로그인 없이 누구나 보내므로 받는 값을 좁게 제한한다. 경로는 쿼리·해시를
 * 뺀 pathname 만 받고, 관리자 화면은 운영자 자신의 이동이라 방문으로 세지 않는다.
 * referrer·utmSource 는 외부에서 처음 들어온 방문에만 실려 오는 선택 값이다.
 */
export function readVisitBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!Object.keys(body).every((key) => ALLOWED_KEYS.includes(key))) return null;

  const { visitorId, path, referrer, utmSource } = body;
  if (typeof visitorId !== "string" || !VISITOR_ID_PATTERN.test(visitorId)) return null;
  if (typeof path !== "string" || !path.startsWith("/") || path.length > VISIT_PATH_MAX_LENGTH) return null;
  if (/[?#\s]/.test(path)) return null;
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  if (referrer !== undefined && referrer !== null && typeof referrer !== "string") return null;
  if (utmSource !== undefined && utmSource !== null && typeof utmSource !== "string") return null;

  return {
    visitorId,
    path,
    referrer: normalizeReferrer(referrer),
    utmSource: typeof utmSource === "string" && UTM_SOURCE_PATTERN.test(utmSource) ? utmSource : null,
  };
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
        data: {
          visitorId: visit.visitorId,
          path: visit.path,
          userId,
          referrer: visit.referrer,
          utmSource: visit.utmSource,
        },
        select: { id: true },
      });

      return sendJson(res, 200, { recorded: true }, requestId);
    });
  };
}
