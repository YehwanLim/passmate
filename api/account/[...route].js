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

export function createAccountRoutesHandler({
  scheduleHandler = createAccountDeletionHandler(),
  cancelHandler = createAccountDeletionCancelHandler(),
} = {}) {
  return async function accountRoutesHandler(req, res) {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

    if (req.headers["x-route-diag"] === "1") {
      return res.status(200).json({ rawUrl: req.url ?? null, pathname, query: req.query ?? null });
    }

    if (pathname === "/api/account/deletion") return scheduleHandler(req, res);
    if (pathname === "/api/account/deletion/cancel") return cancelHandler(req, res);

    return withApiHandler(req, res, async () => {
      throw new ApiError("NOT_FOUND", 404);
    });
  };
}

export default createAccountRoutesHandler();
