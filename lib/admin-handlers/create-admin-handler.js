import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "../request-errors.js";

/**
 * 관리자 핸들러 공통 서문: requestId → 관리자 인증 → 메서드 검사 → 본문 → 불투명 에러.
 * 인증이 메서드 검사보다 먼저 돌아 비인증 요청은 어떤 메서드든 401/403 을 받는다(기존 동작).
 * 라우터(api/admin/[...route].js)도 requireAdministrator 를 한 번 더 부르지만 그건 의도된 이중 방어다.
 *
 * work({ administrator, db, req, requestId, res }) 는 응답을 보내고 그 반환값을 돌려준다.
 */
export function createAdminHandler({ db = prisma, methods, requireAdmin, route }, work) {
  const allowed = new Set(methods);
  const authenticate = requireAdmin ?? ((req) => requireAdministrator(req, db));
  return async function handler(req, res) {
    const requestId = requestIdFor(req);
    try {
      const administrator = await authenticate(req);
      if (!allowed.has(req.method)) return sendMethodNotAllowed(res, requestId);
      return await work({ administrator, db, req, requestId, res });
    } catch (error) {
      return handleRequestError(res, error, requestId, route);
    }
  };
}
