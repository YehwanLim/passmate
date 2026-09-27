import { ApiError, sendJson, withApiHandler } from "./api-handler.js";
import { requireAuthenticatedUser } from "./auth.js";
import prisma from "./prisma.js";

export const VISIT_PATH_MAX_LENGTH = 200;
export const VISIT_REFERRER_MAX_LENGTH = 200;
export const CLIENT_EVENT_DETAIL_MAX_LENGTH = 120;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const UTM_SOURCE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;
// client/src/lib/inAppBrowser.ts 의 kind 값. 소문자와 하이픈뿐이다.
const IN_APP_BROWSER_PATTERN = /^[a-z-]{1,32}$/;
const ALLOWED_KEYS = ["visitorId", "path", "referrer", "utmSource", "inAppBrowser"];
const EVENT_ALLOWED_KEYS = ["visitorId", "event", "detail", "inAppBrowser"];

/**
 * 로그인 화면에서 올라오는 이벤트 이름. 클라이언트(siteVisits.ts sendClientEvent)와 대시보드가 같이 쓰는 계약이라
 * 목록 밖의 이름은 400 으로 거절한다 — 누구나 보낼 수 있는 엔드포인트라 임의 문자열을 쌓지 않는다.
 */
export const CLIENT_EVENT_NAMES = Object.freeze([
  "login_prompt_in_app",
  "google_button_unavailable",
  "google_signin_failed",
  "kakao_start_failed",
]);

function readInAppBrowser(value) {
  return typeof value === "string" && IN_APP_BROWSER_PATTERN.test(value) ? value : null;
}

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

  const { visitorId, path, referrer, utmSource, inAppBrowser } = body;
  if (typeof visitorId !== "string" || !VISITOR_ID_PATTERN.test(visitorId)) return null;
  if (typeof path !== "string" || !path.startsWith("/") || path.length > VISIT_PATH_MAX_LENGTH) return null;
  if (/[?#\s]/.test(path)) return null;
  if (path === "/admin" || path.startsWith("/admin/")) return null;
  if (referrer !== undefined && referrer !== null && typeof referrer !== "string") return null;
  if (utmSource !== undefined && utmSource !== null && typeof utmSource !== "string") return null;
  if (inAppBrowser !== undefined && inAppBrowser !== null && typeof inAppBrowser !== "string") return null;

  return {
    visitorId,
    path,
    referrer: normalizeReferrer(referrer),
    utmSource: typeof utmSource === "string" && UTM_SOURCE_PATTERN.test(utmSource) ? utmSource : null,
    inAppBrowser: readInAppBrowser(inAppBrowser),
  };
}

/**
 * 로그인 화면 이벤트 본문. 방문 핑과 같은 엔드포인트로 오지만 `event` 필드가 있으면 이쪽이다.
 * detail 은 짧은 코드나 오류 문구 앞부분만 받는다(잘라서). 자소서 본문·이메일·토큰이 올 자리가 아니다.
 */
export function readClientEventBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!Object.keys(body).every((key) => EVENT_ALLOWED_KEYS.includes(key))) return null;

  const { visitorId, event, detail, inAppBrowser } = body;
  if (typeof visitorId !== "string" || !VISITOR_ID_PATTERN.test(visitorId)) return null;
  if (!CLIENT_EVENT_NAMES.includes(event)) return null;
  if (detail !== undefined && detail !== null && typeof detail !== "string") return null;
  if (inAppBrowser !== undefined && inAppBrowser !== null && typeof inAppBrowser !== "string") return null;

  return {
    visitorId,
    name: event,
    detail: typeof detail === "string" && detail.length > 0 ? detail.slice(0, CLIENT_EVENT_DETAIL_MAX_LENGTH) : null,
    inAppBrowser: readInAppBrowser(inAppBrowser),
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

      // 함수 12개 제한 때문에 로그인 화면 이벤트도 이 엔드포인트로 받는다. `event` 가 있으면 방문이 아니다.
      if (req.body && typeof req.body === "object" && "event" in req.body) {
        const event = readClientEventBody(req.body);
        if (!event) throw new ApiError("INVALID_REQUEST", 400);

        const userId = await resolveUserId(req, db, authenticate);
        await db.clientEvent.create({
          data: {
            visitorId: event.visitorId,
            userId,
            name: event.name,
            detail: event.detail,
            inAppBrowser: event.inAppBrowser,
          },
          select: { id: true },
        });

        return sendJson(res, 200, { recorded: true }, requestId);
      }

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
          inAppBrowser: visit.inAppBrowser,
        },
        select: { id: true },
      });

      return sendJson(res, 200, { recorded: true }, requestId);
    });
  };
}
