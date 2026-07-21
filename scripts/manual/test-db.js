// =============================================================================
// DB CRUD 테스트 API (Vercel Serverless)
// GET /api/test-db → User, Project, Analysis + TokenUsage 생성 & 조회
// =============================================================================

import prisma from "../../lib/prisma.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ─────────────────────────────────────────────────────────
    // 1. 테스트 User 생성 (이미 있으면 기존 데이터 사용)
    // ─────────────────────────────────────────────────────────
    const testEmail = "test@passmate.kr";

    let user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: testEmail,
          name: "테스트 유저",
        },
      });
      console.log("✅ User 생성:", user.id);
    } else {
      console.log("ℹ️ 기존 User 사용:", user.id);
    }

    // ─────────────────────────────────────────────────────────
    // 2. 테스트 Project 생성
    // ─────────────────────────────────────────────────────────
    const project = await prisma.project.create({
      data: {
        userId: user.id,
        title: "삼성전자 PM 지원서 (테스트)",
        company: "삼성전자",
        jobKeyword: "PM",
      },
    });
    console.log("✅ Project 생성:", project.id);

    // ─────────────────────────────────────────────────────────
    // 3. Analysis + TokenUsage 동시 생성 (nested create)
    // ─────────────────────────────────────────────────────────
    const analysis = await prisma.analysis.create({
      data: {
        userId: user.id,
        projectId: project.id,
        questionText: "테스트 질문: 본인의 강점을 설명해 주세요.",
        inputText:
          "저는 데이터 기반 의사결정을 중시하는 PM입니다. 테스트 자기소개서 내용입니다.",
        aiResponseJson: {
          score: 80,
          summary: "데이터 중심 사고가 돋보이는 답변입니다.",
          strengths: ["논리적 구성", "경험 기반 서술"],
          improvements: ["구체적 수치 추가 필요"],
        },
        aiScore: 80,
        status: "SUCCESS",
        promptVersion: "1.0",
        modelName: "gemini-1.5-flash",
        modelProvider: "gemini",
        totalChars: 42,
        responseTime: 3200,

        // TokenUsage relation 동시 생성
        tokenUsages: {
          create: {
            modelName: "gemini-1.5-flash",
            modelProvider: "gemini",
            promptTokens: 850,
            completionTokens: 320,
            totalTokens: 1170,
            cost: 0.001,
            costCurrency: "USD",
            callType: "ANALYSIS",
            latencyMs: 3200,
            httpStatus: 200,
            isSuccess: true,
          },
        },
      },
      // 생성된 데이터를 relation 포함하여 반환
      include: {
        tokenUsages: true,
        user: { select: { id: true, email: true, name: true } },
        project: { select: { id: true, title: true, company: true } },
      },
    });
    console.log("✅ Analysis + TokenUsage 생성:", analysis.id);

    // ─────────────────────────────────────────────────────────
    // 4. 전체 Analysis 리스트 조회 (relations 포함)
    // ─────────────────────────────────────────────────────────
    const list = await prisma.analysis.findMany({
      include: {
        tokenUsages: true,
        feedbacks: true,
        user: { select: { id: true, email: true, name: true } },
        project: {
          select: { id: true, title: true, company: true, jobKeyword: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // ─────────────────────────────────────────────────────────
    // 5. 테이블별 카운트 (요약)
    // ─────────────────────────────────────────────────────────
    const counts = {
      users: await prisma.user.count(),
      projects: await prisma.project.count(),
      analyses: await prisma.analysis.count(),
      tokenUsages: await prisma.tokenUsage.count(),
      feedbacks: await prisma.feedback.count(),
      promptTemplates: await prisma.promptTemplate.count(),
    };

    return res.status(200).json({
      success: true,
      message: "✅ CRUD 테스트 완료!",
      created: {
        user: { id: user.id, email: user.email, name: user.name },
        project: {
          id: project.id,
          title: project.title,
          company: project.company,
        },
        analysis,
      },
      list,
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ DB 테스트 실패:", error);
    return res.status(500).json({
      success: false,
      error: "DB 테스트 실패",
      message: error.message,
      code: error.code || "UNKNOWN",
      stack:
        process.env.NODE_ENV !== "production" ? error.stack : undefined,
    });
  }
}
