import { finalizeAnalysisReservation } from "../../lib/analysis-entitlements.js";
import {
  readOwnedAnalysisRequestStatus,
} from "../../lib/analysis-request-lifecycle.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../../lib/api-handler.js";
import { requireActiveApplicationUser } from "../../lib/auth.js";
import prisma from "../../lib/prisma.js";

const OWNED_STATUS_SELECT = {
  id: true,
  status: true,
  expiresAt: true,
  analysisId: true,
  idempotencyKey: true,
  requestHash: true,
  reservationId: true,
  providerMetadata: true,
  providerResult: true,
  analysis: { select: { errorCode: true, id: true, projectId: true } },
};

function safeErrorCode(analysisRequest) {
  if (analysisRequest.status !== "FAILED") return null;
  return analysisRequest.analysis?.errorCode === "CONTEXT_IRRELEVANT"
    ? "CONTEXT_IRRELEVANT"
    : "ANALYSIS_FAILED";
}

function statusResponse(analysisRequest, requestId) {
  return {
    id: analysisRequest.id,
    status: analysisRequest.status,
    analysis_id: analysisRequest.status === "SUCCEEDED" && typeof analysisRequest.analysisId === "string"
      ? analysisRequest.analysisId
      : null,
    error: safeErrorCode(analysisRequest),
    requestId,
  };
}

export function createAnalysisRequestStatusHandler({
  db = prisma,
  finalizeReservation = finalizeAnalysisReservation,
  lifecycle = readOwnedAnalysisRequestStatus,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const id = req.query?.id;
      if (typeof id !== "string" || id.length === 0) {
        throw new ApiError("INVALID_REQUEST", 400);
      }

      const { applicationUser } = await requireUser(req, db);
      const stored = await db.analysisRequest.findFirst({
        where: { id, userId: applicationUser.id },
        select: OWNED_STATUS_SELECT,
      });
      if (!stored) {
        throw new ApiError("NOT_FOUND", 404);
      }

      const current = await lifecycle({
        analysisRequest: stored,
        db,
        finalize: finalizeReservation,
        requestId,
        userId: applicationUser.id,
      });
      if (!current) {
        throw new ApiError("NOT_FOUND", 404);
      }

      return sendJson(res, 200, statusResponse(current, requestId), requestId);
    });
  };
}

export default createAnalysisRequestStatusHandler();
