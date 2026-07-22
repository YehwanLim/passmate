// =============================================================================
// GET /api/projects — Project 리스트 API
// POST /api/projects — 분석 성공 결과를 Project + Analysis로 저장
// My 탭 카드에 필요한 데이터만 경량으로 반환
// =============================================================================

import dotenv from "dotenv";

dotenv.config();

const { default: prisma } = await import("../lib/prisma.js");

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

    return (
      data.summary ??
      data.firstImpression?.summaryOneLiner ??
      data.firstImpression?.persona ??
      null
    );
    // TODO: keywords 컬럼 향후 추가 시 여기서 함께 추출
  } catch (e) {
    console.error("[extractSummary] 파싱 실패:", e.message);
    return null;
  }
}

function sanitizeText(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function buildProjectTitle(company, jobKeyword) {
  const safeCompany = sanitizeText(company, "기업 미지정");
  const safeJob = sanitizeText(jobKeyword);
  return safeJob ? `${safeCompany} ${safeJob} 지원서` : `${safeCompany} 지원서`;
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((question, index) => ({
      question: sanitizeText(question?.question ?? question?.question_text, `문항 ${index + 1}`),
      answer: sanitizeText(question?.answer ?? question?.input_text),
    }))
    .filter((question) => question.answer.length > 0);
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeAnalysisMeta(meta) {
  if (!meta || typeof meta !== "object") {
    return {
      modelName: null,
      modelProvider: null,
      responseTimeMs: null,
      httpStatus: null,
      tokenUsage: null,
    };
  }

  const tokenUsage = meta.tokenUsage && typeof meta.tokenUsage === "object"
    ? {
        promptTokens: toNumberOrNull(meta.tokenUsage.promptTokens) ?? 0,
        completionTokens: toNumberOrNull(meta.tokenUsage.completionTokens) ?? 0,
        totalTokens: toNumberOrNull(meta.tokenUsage.totalTokens) ?? 0,
      }
    : null;

  return {
    modelName: sanitizeText(meta.modelName) || null,
    modelProvider: sanitizeText(meta.modelProvider) || null,
    responseTimeMs: toNumberOrNull(meta.responseTimeMs),
    httpStatus: toNumberOrNull(meta.httpStatus),
    tokenUsage,
  };
}

async function handlePost(req, res) {
  const user = req.body?.user;
  const questions = normalizeQuestions(req.body?.questions);
  const aiResponseJson = req.body?.result;
  const analysisMeta = normalizeAnalysisMeta(req.body?.analysisMeta ?? aiResponseJson?.analysisMeta);
  const company = sanitizeText(req.body?.company);
  const jobKeyword = sanitizeText(req.body?.jobKeyword);

  if (!user?.id || !user?.email) {
    return res.status(400).json({ error: "로그인 사용자 정보가 필요합니다." });
  }

  if (!aiResponseJson || questions.length === 0) {
    return res.status(400).json({ error: "저장할 분석 결과와 문항이 필요합니다." });
  }

  const totalChars = questions.reduce((sum, question) => sum + question.answer.length, 0);
  const questionText = questions.map((question, index) => `[문항 ${index + 1}] ${question.question}`).join("\n\n");
  const inputText = questions.map((question, index) => `[문항 ${index + 1}]\n${question.answer}`).join("\n\n");

  const saved = await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        avatarUrl: user.profile_image ?? null,
      },
      update: {
        email: user.email,
        name: user.name ?? null,
        avatarUrl: user.profile_image ?? null,
      },
    });

    const project = await tx.project.create({
      data: {
        userId: user.id,
        title: buildProjectTitle(company, jobKeyword),
        company: company || null,
        jobKeyword: jobKeyword || null,
      },
    });

    const analysis = await tx.analysis.create({
      data: {
        userId: user.id,
        projectId: project.id,
        questionText,
        inputText,
        aiResponseJson,
        status: "SUCCESS",
        modelName: analysisMeta.modelName ?? null,
        modelProvider: analysisMeta.modelProvider ?? null,
        totalChars,
        responseTime: analysisMeta.responseTimeMs,
        tokenUsages: analysisMeta.tokenUsage && analysisMeta.modelName && analysisMeta.modelProvider
          ? {
              create: {
                modelName: analysisMeta.modelName,
                modelProvider: analysisMeta.modelProvider,
                promptTokens: analysisMeta.tokenUsage.promptTokens,
                completionTokens: analysisMeta.tokenUsage.completionTokens,
                totalTokens: analysisMeta.tokenUsage.totalTokens,
                cost: null,
                costCurrency: "USD",
                callType: "ANALYSIS",
                latencyMs: analysisMeta.responseTimeMs,
                httpStatus: analysisMeta.httpStatus,
                isSuccess: true,
              },
            }
          : undefined,
      },
    });

    return { project, analysis };
  });

  return res.status(201).json({
    project_id: saved.project.id,
    analysis_id: saved.analysis.id,
  });
}

// =============================================================================
// Handler
// =============================================================================
export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      return await handlePost(req, res);
    } catch (error) {
      console.error("❌ [POST /api/projects] 에러:", error);
      return res.status(500).json({
        error: "분석 결과 저장에 실패했습니다.",
        message: process.env.NODE_ENV !== "production" ? error.message : undefined,
      });
    }
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const userId = req.query?.userId;
    if (!userId) {
      return res.status(200).json([]);
    }

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
            id: true,
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
        latest_analysis_id: latest?.id ?? null,
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
