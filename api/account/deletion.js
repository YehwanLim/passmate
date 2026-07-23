import { requestAccountDeletion } from "../../lib/account-deletion.js";
import { recordAuditEvent } from "../../lib/audit-log.js";
import { requireActiveApplicationUser } from "../../lib/auth.js";
import { ApiError, sendJson, withApiHandler } from "../../lib/api-handler.js";
import prisma from "../../lib/prisma.js";

export function createAccountDeletionHandler({
  db = prisma,
  requestDeletion = requestAccountDeletion,
  requireUser = (req) => requireActiveApplicationUser(req, db),
} = {}) {
  return async function accountDeletionHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      }

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

export default createAccountDeletionHandler();
