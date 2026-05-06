// =============================================================================
// GET /api/projects/[projectId] — Project 단건 조회 API
// MyAnalyses 페이지에서 프로젝트 헤더 정보를 표시할 때 사용
// =============================================================================

import prisma from "../../lib/prisma.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId가 필요합니다." });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
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
          select: {
            totalChars: true,
            aiResponseJson: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다." });
    }

    // 후처리: camelCase → snake_case 매핑
    const latest = project.analyses?.[0];

    let summary = null;
    try {
      if (latest?.aiResponseJson) {
        const data =
          typeof latest.aiResponseJson === "string"
            ? JSON.parse(latest.aiResponseJson)
            : latest.aiResponseJson;
        summary = data?.summary ?? null;
      }
    } catch (e) {
      console.error("[extractSummary] 파싱 실패:", e.message);
    }

    const result = {
      id: project.id,
      title: project.title,
      company_name: project.company ?? null,
      job_role: project.jobKeyword ?? null,
      created_at: project.createdAt,
      analysis_count: project._count.analyses,
      total_chars: latest?.totalChars ?? 0,
      summary,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [GET /api/projects/[projectId]] 에러:", error);
    return res.status(500).json({
      error: "프로젝트 조회에 실패했습니다.",
      message: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
