import prisma from "../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../lib/api-handler.js";
import { requireActiveApplicationUser } from "../lib/auth.js";

function isValidFeedbackBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const keys = Object.keys(body);
  if (!keys.every((key) => ["analysisId", "rating", "comment"].includes(key))) return false;
  if (typeof body.analysisId !== "string" || body.analysisId.length === 0) return false;
  if (!["THUMBS_UP", "THUMBS_DOWN"].includes(body.rating)) return false;
  return body.comment === undefined
    || body.comment === null
    || (typeof body.comment === "string" && body.comment.length <= 2000);
}

export function createFeedbackHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "POST") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }
      if (!isValidFeedbackBody(req.body)) {
        throw new ApiError("INVALID_REQUEST", 400);
      }

      const { applicationUser } = await requireUser(req, db);
      const { analysisId, rating, comment } = req.body;
      const analysis = await db.analysis.findFirst({
        where: { id: analysisId, userId: applicationUser.id },
        select: { id: true },
      });
      if (!analysis) {
        throw new ApiError("NOT_FOUND", 404);
      }

      const feedback = await db.feedback.upsert({
        where: { analysisId_userId: { analysisId, userId: applicationUser.id } },
        update: { rating, comment: comment ?? null },
        create: { analysisId, userId: applicationUser.id, rating, comment: comment ?? null },
        select: { id: true, rating: true, comment: true, createdAt: true },
      });

      return sendJson(res, 200, {
        id: feedback.id,
        rating: feedback.rating,
        comment: feedback.comment,
        created_at: feedback.createdAt,
      }, requestId);
    });
  };
}

export default createFeedbackHandler();
