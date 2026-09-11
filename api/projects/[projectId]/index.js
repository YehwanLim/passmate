import prisma from "../../../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../../../lib/api-handler.js";
import { requireActiveApplicationUser } from "../../../lib/auth.js";
// 목록(api/projects.js)과 같은 규칙으로 요약을 읽는다. 예전엔 여기만 구버전 summary 필드만 봤다.
import { extractSummary } from "../../../lib/report-fields.js";

export function createProjectDetailHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET" && req.method !== "DELETE") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const projectId = req.query?.projectId;
      if (typeof projectId !== "string" || projectId.length === 0) {
        throw new ApiError("INVALID_REQUEST", 400);
      }

      const { applicationUser } = await requireUser(req, db);
      const where = { id: projectId, userId: applicationUser.id };

      if (req.method === "DELETE") {
        const deleted = await db.project.deleteMany({ where });
        if (deleted.count === 0) {
          throw new ApiError("NOT_FOUND", 404);
        }
        return res.status(204).end();
      }

      const project = await db.project.findFirst({
        where,
        select: {
          id: true,
          title: true,
          company: true,
          jobKeyword: true,
          createdAt: true,
          _count: { select: { analyses: true } },
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { totalChars: true, aiResponseJson: true },
          },
        },
      });
      if (!project) {
        throw new ApiError("NOT_FOUND", 404);
      }

      const latest = project.analyses?.[0];
      return sendJson(res, 200, {
        id: project.id,
        title: project.title,
        company_name: project.company ?? null,
        job_role: project.jobKeyword ?? null,
        created_at: project.createdAt,
        analysis_count: project._count.analyses,
        total_chars: latest?.totalChars ?? 0,
        summary: extractSummary(latest?.aiResponseJson),
      }, requestId);
    });
  };
}

export default createProjectDetailHandler();
