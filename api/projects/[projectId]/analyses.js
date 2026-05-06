// =============================================================================
// GET /api/projects/[projectId]/analyses — Analysis 리스트 API
// 경량 응답: ai_response_json, input_text 제외
// =============================================================================

import prisma from "../../../lib/prisma.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: "projectId가 필요합니다." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Prisma 쿼리: select로 경량 필드만 반환
    // ❌ aiResponseJson 제외 (무거움)
    // ❌ inputText 제외 (상세 API에서만 반환)
    // ─────────────────────────────────────────────────────────────────────
    const analyses = await prisma.analysis.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        questionText: true,    // → API: question_text
        status: true,
        createdAt: true,       // → API: created_at
      },
    });

    // ─────────────────────────────────────────────────────────────────────
    // 후처리: camelCase → snake_case 매핑
    // 데이터 없으면 빈 배열 반환 (404 아님, 정상 상태)
    // ─────────────────────────────────────────────────────────────────────
    const result = analyses.map((a) => ({
      id: a.id,
      question_text: a.questionText,
      status: a.status,
      created_at: a.createdAt,
    }));

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [GET /api/projects/[projectId]/analyses] 에러:", error);
    return res.status(500).json({
      error: "분석 목록 조회에 실패했습니다.",
      message: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
