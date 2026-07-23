import prisma from "../../../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../../../lib/api-handler.js";
import { requireActiveApplicationUser } from "../../../lib/auth.js";

export function createProjectAnalysesHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const projectId = req.query?.projectId;
      if (typeof projectId !== "string" || projectId.length === 0) {
        throw new ApiError("INVALID_REQUEST", 400);
      }

      const { applicationUser } = await requireUser(req, db);
      const project = await db.project.findFirst({
        where: { id: projectId, userId: applicationUser.id },
        select: { id: true },
      });
      if (!project) {
        throw new ApiError("NOT_FOUND", 404);
      }

      const analyses = await db.analysis.findMany({
        where: { projectId, userId: applicationUser.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, questionText: true, status: true, createdAt: true },
      });

      return sendJson(res, 200, analyses.map((analysis) => ({
        id: analysis.id,
        question_text: analysis.questionText,
        status: analysis.status,
        created_at: analysis.createdAt,
      })), requestId);
    });
  };
}

export default createProjectAnalysesHandler();
