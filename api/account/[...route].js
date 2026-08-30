import { cancelAccountDeletion, requestAccountDeletion } from "../../lib/account-deletion.js";
import { recordAuditEvent } from "../../lib/audit-log.js";
import {
  AuthorizationError,
  requireActiveApplicationUser,
  requireAuthenticatedUser,
} from "../../lib/auth.js";
import { ApiError, sendJson, withApiHandler } from "../../lib/api-handler.js";
import prisma from "../../lib/prisma.js";

export function createAccountDeletionHandler({
  db = prisma,
  requestDeletion = requestAccountDeletion,
  requireUser = (req) => requireActiveApplicationUser(req, db),
} = {}) {
  return async function accountDeletionHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);

      const { applicationUser } = await requireUser(req);
      try {
        const deletion = await requestDeletion({ prisma: db, userId: applicationUser.id });
        await recordAuditEvent({
          actorId: applicationUser.id,
          db,
          outcome: "SCHEDULED",
          requestId,
          targetId: applicationUser.id,
          targetType: "account_deletion",
        });
        return sendJson(res, 202, {
          deletionPending: true,
          purgeAt: deletion.purgeAt.toISOString(),
        }, requestId);
      } catch (error) {
        if (error?.code && Number.isInteger(error?.statusCode)) {
          throw new ApiError(error.code, error.statusCode);
        }
        throw error;
      }
    });
  };
}

export function createAccountDeletionCancelHandler({
  authenticate = requireAuthenticatedUser,
  cancelDeletion = cancelAccountDeletion,
  db = prisma,
} = {}) {
  return async function accountDeletionCancelHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);

      const user = await authenticate(req);
      if (!user) {
        throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "Unauthorized");
      }

      try {
        await cancelDeletion({ prisma: db, userId: user.id });
        await recordAuditEvent({
          actorId: user.id,
          db,
          outcome: "CANCELLED",
          requestId,
          targetId: user.id,
          targetType: "account_deletion",
        });
        return sendJson(res, 200, { deletionPending: false }, requestId);
      } catch (error) {
        if (error?.code && Number.isInteger(error?.statusCode)) {
          throw new ApiError(error.code, error.statusCode);
        }
        throw error;
      }
    });
  };
}

// vercel.json 의 rewrite(`?route=:path*`)와 Vercel 파일시스템 catch-all 은
// 경로를 query.route 로 전달하므로, admin 라우터와 동일하게 query 를 먼저 보고
// pathname 은 개발 미들웨어 등 query 가 없는 경로의 폴백으로만 쓴다.
function accountRouteSegments(req) {
  const route = req.query?.route;
  if (Array.isArray(route)) return route.filter((part) => typeof part === "string");
  if (typeof route === "string") return route.split("/").filter(Boolean);

  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  return pathname.replace(/^\/api\/account\/?/, "").split("/").filter(Boolean);
}

export function createAccountRoutesHandler({
  scheduleHandler = createAccountDeletionHandler(),
  cancelHandler = createAccountDeletionCancelHandler(),
} = {}) {
  return async function accountRoutesHandler(req, res) {
    const segments = accountRouteSegments(req);

    if (segments.length === 1 && segments[0] === "deletion") return scheduleHandler(req, res);
    if (segments.length === 2 && segments[0] === "deletion" && segments[1] === "cancel") {
      return cancelHandler(req, res);
    }

    return withApiHandler(req, res, async () => {
      throw new ApiError("NOT_FOUND", 404);
    });
  };
}

export default createAccountRoutesHandler();
