import { timingSafeEqual } from "node:crypto";

import { purgeDueAccounts } from "../../lib/account-deletion.js";
import { purgeExpiredAuditEvents } from "../../lib/audit-log.js";
import { getSupabaseAdminClient } from "../../lib/auth.js";
import { ApiError, sendJson, withApiHandler } from "../../lib/api-handler.js";
import prisma from "../../lib/prisma.js";

function authorizedCronRequest(req, cronSecret) {
  const authorization = req.headers?.authorization ?? req.headers?.Authorization;
  const expected = cronSecret ? `Bearer ${cronSecret}` : "";
  if (typeof authorization !== "string" || !expected || authorization.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expected));
}

// 진단에 길이를 남기면 로그 접근자가 CRON_SECRET 의 키스페이스를 알게 되므로
// 존재 여부(boolean)만 기록한다.
function rejectedCronAuthorizationDiagnostic(req, cronSecret) {
  const authorization = req.headers?.authorization ?? req.headers?.Authorization;
  return {
    authorizationHeaderPresent: typeof authorization === "string",
    cronSecretConfigured: Boolean(cronSecret),
  };
}

export function createPurgeDeletedAccountsHandler({
  cronSecret = process.env.CRON_SECRET,
  db = prisma,
  getAdminClient = getSupabaseAdminClient,
  purgeAccounts = purgeDueAccounts,
} = {}) {
  return async function purgeDeletedAccountsHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET") {
        throw new ApiError("METHOD_NOT_ALLOWED", 405);
      }
      if (!authorizedCronRequest(req, cronSecret)) {
        console.warn("[api/cron/purge] authorization rejected", rejectedCronAuthorizationDiagnostic(req, cronSecret));
        throw new ApiError("CRON_AUTH_REQUIRED", 401);
      }

      const client = getAdminClient();
      const result = await purgeAccounts({
        prisma: db,
        deleteAuthUser: async (userId) => {
          const { error } = await client.auth.admin.deleteUser(userId);
          if (error && !/not found/i.test(error.message ?? "")) {
            throw new ApiError("AUTH_IDENTITY_PURGE_FAILED", 502);
          }
        },
      });
      await purgeExpiredAuditEvents({ db });
      return sendJson(res, 200, { purged: result.purged }, requestId);
    });
  };
}

export default createPurgeDeletedAccountsHandler();
