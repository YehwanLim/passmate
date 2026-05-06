// =============================================================================
// GET /api/projects — Project 리스트 API
// My 탭 카드에 필요한 데이터만 경량으로 반환
// =============================================================================

import prisma from "../lib/prisma.js";

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼: aiResponseJson에서 summary를 안전하게 추출
// ─────────────────────────────────────────────────────────────────────────────
function extractSummary(aiResponseJson) {
  try {
    if (aiResponseJson == null) return null;

    const data =
      typeof aiResponseJson === "string"
        ? JSON.parse(aiResponseJson)
        : aiResponseJson;

    if (!data || typeof data !== "object") return null;

    return data.summary ?? null;
    // TODO: keywords 컬럼 향후 추가 시 여기서 함께 추출
  } catch (e) {
    console.error("[extractSummary] 파싱 실패:", e.message);
    return null;
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
    // TODO: auth 연동 시 req.user.id로 userId 필터 교체
    // MVP 단계: 첫 번째 유저 기준으로 조회
    const firstUser = await prisma.user.findFirst({
      select: { id: true },
    });

    if (!firstUser) {
      // 유저 자체가 없으면 빈 배열 반환 (정상 상태)
      return res.status(200).json([]);
    }

    const userId = firstUser.id;

    // ─────────────────────────────────────────────────────────────────────
    // Prisma 쿼리: select + take:1 + _count 조합 (성능 최적화)
    // ❌ include: { analyses: true } 절대 사용 금지
    // ─────────────────────────────────────────────────────────────────────
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        company: true,         // → API: company_name
        jobKeyword: true,      // → API: job_role
        createdAt: true,       // → API: created_at
        _count: {
          select: { analyses: true },
        },
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 1,             // ★ 최신 1개만 가져옴
          select: {
            totalChars: true,
            aiResponseJson: true,
          },
        },
      },
    });

    // ─────────────────────────────────────────────────────────────────────
    // 후처리: camelCase → snake_case 매핑 + summary 추출 + 방어 처리
    // ─────────────────────────────────────────────────────────────────────
    const result = projects.map((p) => {
      const latest = p.analyses?.[0]; // 최신 analysis (없으면 undefined)

      return {
        id: p.id,
        title: p.title,
        company_name: p.company ?? null,
        job_role: p.jobKeyword ?? null,
        created_at: p.createdAt,
        analysis_count: p._count.analyses,
        total_chars: latest?.totalChars ?? 0,              // 없으면 0
        summary: extractSummary(latest?.aiResponseJson),   // 없으면 null
        // TODO: keywords 컬럼 향후 추가 시 여기에 포함
      };
    });

    // TODO: summary를 DB 컬럼(Project)으로 승격하면 analyses JOIN 불필요

    return res.status(200).json(result);
  } catch (error) {
    console.error("❌ [GET /api/projects] 에러:", error);
    return res.status(500).json({
      error: "프로젝트 목록 조회에 실패했습니다.",
      message: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
