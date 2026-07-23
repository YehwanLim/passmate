import prisma from "../../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../../lib/api-handler.js";
import { requireActiveApplicationUser } from "../../lib/auth.js";

function sanitizeAiResponse(json) {
  try {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    if (!data || typeof data !== "object") return null;
    const { score, ...rest } = data;
    return rest;
  } catch {
    return null;
  }
}

export function createAnalysisHandler({
  db = prisma,
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
      const analysis = await db.analysis.findFirst({
        where: { id, userId: applicationUser.id },
        select: {
          id: true,
          questionText: true,
          inputText: true,
          aiResponseJson: true,
          status: true,
          totalChars: true,
          createdAt: true,
          projectId: true,
          project: { select: { company: true, jobKeyword: true, title: true } },
        },
      });
      if (!analysis) {
        throw new ApiError("NOT_FOUND", 404);
      }

      return sendJson(res, 200, {
        id: analysis.id,
        question_text: analysis.questionText,
        input_text: analysis.inputText,
        ai_response_json: sanitizeAiResponse(analysis.aiResponseJson),
        status: analysis.status,
        total_chars: analysis.totalChars ?? 0,
        created_at: analysis.createdAt,
        project_id: analysis.projectId,
        company_name: analysis.project?.company ?? null,
        job_role: analysis.project?.jobKeyword ?? null,
        project_title: analysis.project?.title ?? null,
      }, requestId);
    });
  };
}

export default createAnalysisHandler();
