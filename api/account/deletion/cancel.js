import { cancelAccountDeletion } from "../../../lib/account-deletion.js";
import { recordAuditEvent } from "../../../lib/audit-log.js";
import { AuthorizationError, requireAuthenticatedUser } from "../../../lib/auth.js";
import { ApiError, sendJson, withApiHandler } from "../../../lib/api-handler.js";
import prisma from "../../../lib/prisma.js";

export function createAccountDeletionCancelHandler({
  authenticate = requireAuthenticatedUser,
  cancelDeletion = cancelAccountDeletion,
  db = prisma,
} = {}) {
  return async function accountDeletionCancelHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      }

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

export default createAccountDeletionCancelHandler();
