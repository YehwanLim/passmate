// =============================================================================
// GET /api/analysis/[id] — Analysis 상세 API
// 전체 리포트 데이터 반환 (score만 안전하게 제거)
// =============================================================================

import prisma from "../../lib/prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼: ai_response_json에서 score를 안전하게 제거
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeAiResponse(json) {
  try {
    if (json == null) return null;

    const data =
      typeof json === "string" ? JSON.parse(json) : json;

    if (!data || typeof data !== "object") return null;

    // score 필드 제거 후 나머지 반환
    const { score, ...rest } = data;
    return rest;
  } catch (e) {
    console.error("[sanitizeAiResponse] 정제 실패:", e.message);
    return null; // 실패 시 원본 노출 금지 → null fallback
  }
}

// =============================================================================
// Handler
// =============================================================================
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "분석 ID가 필요합니다." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // Prisma 쿼리: 단건 조회 + 필요한 필드만 select
    // ─────────────────────────────────────────────────────────────────────
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: {
        id: true,
        questionText: true,      // → API: question_text
        inputText: true,         // → API: input_text
        aiResponseJson: true,    // → sanitize 후 반환
        status: true,
        totalChars: true,        // → API: total_chars
        createdAt: true,         // → API: created_at
        projectId: true,
        userId: true,
        project: {
          select: {
            company: true,
            jobKeyword: true,
            title: true,
          },
        },
      },
    });

    // ─────────────────────────────────────────────────────────────────────
    // 단건 조회 → 없으면 404 (리스트와 다른 정책)
    // ─────────────────────────────────────────────────────────────────────
    if (!analysis) {
      return res.status(404).json({ error: "해당 분석 데이터를 찾을 수 없습니다." });
    }

    // ─────────────────────────────────────────────────────────────────────
    // 후처리: camelCase → snake_case + score 제거
    // ─────────────────────────────────────────────────────────────────────
    const result = {
      id: analysis.id,
      question_text: analysis.questionText,
      input_text: analysis.inputText,
      ai_response_json: sanitizeAiResponse(analysis.aiResponseJson),
      status: analysis.status,
      total_chars: analysis.totalChars ?? 0,
      created_at: analysis.createdAt,
      project_id: analysis.projectId,
      user_id: analysis.userId,
      company_name: analysis.project?.company ?? null,
      job_role: analysis.project?.jobKeyword ?? null,
      project_title: analysis.project?.title ?? null,
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [GET /api/analysis/[id]] 에러:", error);
    return res.status(500).json({
      error: "분석 상세 조회에 실패했습니다.",
      message: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
