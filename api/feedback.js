// =============================================================================
// POST /api/feedback — 리포트 만족도 피드백 저장
// Prisma upsert 활용 (analysisId + userId unique constraint)
// =============================================================================

import prisma from "../lib/prisma.js";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { analysisId, userId, rating, comment } = req.body || {};

    // ── 입력 유효성 검증 ──
    if (!analysisId || typeof analysisId !== "string") {
      return res.status(400).json({ error: "analysisId가 필요합니다." });
    }
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "userId가 필요합니다." });
    }
    if (!["THUMBS_UP", "THUMBS_DOWN"].includes(rating)) {
      return res
        .status(400)
        .json({ error: "rating은 THUMBS_UP 또는 THUMBS_DOWN이어야 합니다." });
    }

    // ── Analysis 존재 여부 확인 ──
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { id: true },
    });

    if (!analysis) {
      return res
        .status(404)
        .json({ error: "해당 분석 데이터를 찾을 수 없습니다." });
    }

    // ── 익명 유저 자동 생성 (upsert) ──
    const anonymousEmail = `anonymous-${userId}@passmate.local`;

    await prisma.user.upsert({
      where: { email: anonymousEmail },
      update: {}, // 이미 존재하면 변경 없음
      create: {
        id: userId,
        email: anonymousEmail,
        name: "익명 사용자",
      },
    });

    // ── Feedback upsert (동일 analysis + user → 업데이트) ──
    const feedback = await prisma.feedback.upsert({
      where: {
        analysisId_userId: {
          analysisId: analysisId,
          userId: userId,
        },
      },
      update: {
        rating: rating,
        comment: comment || null,
      },
      create: {
        analysisId: analysisId,
        userId: userId,
        rating: rating,
        comment: comment || null,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    console.log(
      `[feedback] ✅ ${rating} 저장 완료 (analysis: ${analysisId.slice(0, 8)}...)`
    );

    return res.status(200).json({
      id: feedback.id,
      rating: feedback.rating,
      comment: feedback.comment,
      created_at: feedback.createdAt,
    });
  } catch (error) {
    console.error("❌ [POST /api/feedback] 에러:", error);

    // Prisma unique constraint 에러 처리
    if (error.code === "P2002") {
      return res.status(409).json({ error: "이미 피드백이 등록되어 있습니다." });
    }

    return res.status(500).json({
      error: "피드백 저장에 실패했습니다.",
      message:
        process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
