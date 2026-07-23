import { recordAuditEvent } from "../audit-log.js";
import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed, sendRequestError } from "../request-errors.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["cancel", "consume"]);

function resolutionData(action) {
  if (action === "consume") {
    return {
      analysis: { errorCode: "API_ERROR", status: "FAILED" },
      auditOutcome: "RECONCILIATION_CONSUMED",
      reservation: { finalizedAt: new Date(), status: "CONSUMED" },
    };
  }
  return {
    analysis: { errorCode: "API_ERROR", status: "FAILED" },
    auditOutcome: "RECONCILIATION_CANCELLED",
    reservation: { cancelledAt: new Date(), status: "CANCELLED" },
  };
}

/**
 * Resolves an uncertain external-provider call only after an operator checks
 * provider-side evidence. This is intentionally admin-only: automatically
 * releasing a CALLING reservation could trigger a duplicate paid invocation.
 */
export function createAnalysisReconciliationHandler({
  db = prisma,
  requireAdmin = (req) => requireAdministrator(req, db),
} = {}) {
  return async function analysisReconciliationHandler(req, res) {
    const requestId = requestIdFor(req);
    try {
      const { applicationUser } = await requireAdmin(req);
      if (req.method !== "POST") return sendMethodNotAllowed(res, requestId);

      const id = String(req.query?.id ?? "");
      const action = req.body?.action;
      if (!UUID_PATTERN.test(id) || !ACTIONS.has(action)) {
        return sendRequestError(res, 400, requestId);
      }

      const outcome = await db.$transaction(async (tx) => {
        const request = await tx.analysisRequest.findUnique({
          where: { id },
          select: { analysisId: true, id: true, reservationId: true, status: true, userId: true },
        });
        if (!request || request.status !== "CALLING") return null;

        const claimed = await tx.analysisRequest.updateMany({
          where: { id: request.id, status: "CALLING" },
          data: { status: "FAILED" },
        });
        if (claimed.count !== 1) return null;

        const resolution = resolutionData(action);
        if (request.analysisId) {
          await tx.analysis.updateMany({
            where: { id: request.analysisId, status: "PENDING", userId: request.userId },
            data: { ...resolution.analysis, errorMessage: null },
          });
        }
        if (request.reservationId) {
          await tx.analysisReservation.updateMany({
            where: { id: request.reservationId, status: "PENDING", userId: request.userId },
            data: resolution.reservation,
          });
        }
        await recordAuditEvent({
          actorId: applicationUser.id,
          db: tx,
          outcome: resolution.auditOutcome,
          requestId,
          targetId: request.analysisId,
          targetType: "analysis",
        });
        return action;
      });

      if (!outcome) return sendRequestError(res, 409, requestId);
      return res.status(200).json({ action: outcome, requestId });
    } catch (error) {
      return handleRequestError(res, error, requestId, "api/admin/analysis-reconciliation/[id]");
    }
  };
}

export default createAnalysisReconciliationHandler();
