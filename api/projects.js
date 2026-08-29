import prisma from "../lib/prisma.js";
import { ApiError, sendError, sendJson, withApiHandler } from "../lib/api-handler.js";
import { requireActiveApplicationUser } from "../lib/auth.js";

// questionText는 문항들을 "[문항 N]" 마커로 합쳐 저장한다(api/analyze.js).
// 마커 수 = 실제 문항 수. 마커가 없는 비어있지 않은 텍스트는 단일 문항으로 본다.
function countQuestions(questionText) {
  if (typeof questionText !== "string" || questionText.trim().length === 0) return 0;
  const markers = questionText.match(/(?:^|\n)\[문항 \d+\]/g);
  return markers ? markers.length : 1;
}

function extractSummary(aiResponseJson) {
  try {
    const data = typeof aiResponseJson === "string" ? JSON.parse(aiResponseJson) : aiResponseJson;
    if (!data || typeof data !== "object") return null;
    return data.summary ?? data.firstImpression?.summaryOneLiner ?? data.firstImpression?.persona ?? null;
  } catch {
    return null;
  }
}

export function createProjectsHandler({
  db = prisma,
  requireUser = requireActiveApplicationUser,
} = {}) {
  return async function handler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET") {
        return sendError(res, 405, "METHOD_NOT_ALLOWED", requestId);
      }

      const { applicationUser } = await requireUser(req, db);
      const projects = await db.project.findMany({
        where: { userId: applicationUser.id },
        orderBy: { createdAt: "desc" },
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
            select: { id: true, totalChars: true, aiResponseJson: true, questionText: true },
          },
        },
      });

      return sendJson(res, 200, projects.map((project) => {
        const latest = project.analyses?.[0];
        return {
          id: project.id,
          title: project.title,
          company_name: project.company ?? null,
          job_role: project.jobKeyword ?? null,
          created_at: project.createdAt,
          analysis_count: project._count.analyses,
          question_count: countQuestions(latest?.questionText),
          latest_analysis_id: latest?.id ?? null,
          total_chars: latest?.totalChars ?? 0,
          summary: extractSummary(latest?.aiResponseJson),
        };
      }), requestId);
    });
  };
}

export default createProjectsHandler();
