import dotenv from "dotenv";

dotenv.config();

const { default: prisma } = await import("../../lib/prisma.js");

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeSortField(value) {
  return value === "response_time_ms" ? "responseTime" : "createdAt";
}

function normalizeSortDir(value) {
  return value === "asc" ? "asc" : "desc";
}

function normalizeStatus(value) {
  return ["PENDING", "SUCCESS", "FAILED"].includes(value) ? value : null;
}

function mapAnalysisRow(analysis) {
  return {
    id: analysis.id,
    status: analysis.status,
    error_code: analysis.errorCode ?? null,
    model_name: analysis.modelName ?? null,
    model_provider: analysis.modelProvider ?? null,
    response_time_ms: analysis.responseTime ?? null,
    total_chars: analysis.totalChars ?? null,
    created_at: analysis.createdAt,
    total_tokens: analysis.tokenUsages.reduce((sum, usage) => sum + (usage.totalTokens ?? 0), 0),
    total_cost: analysis.tokenUsages.reduce((sum, usage) => sum + (usage.cost ?? 0), 0),
    user_email: analysis.user?.email ?? null,
    user_name: analysis.user?.name ?? null,
    project_title: analysis.project?.title ?? null,
    project_company: analysis.project?.company ?? null,
    project_job_keyword: analysis.project?.jobKeyword ?? null,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const page = toInt(req.query?.page, 1);
    const pageSize = Math.min(toInt(req.query?.pageSize, 15), 100);
    const status = normalizeStatus(req.query?.status);
    const model = String(req.query?.model ?? "ALL");
    const search = String(req.query?.search ?? "").trim();
    const sortField = normalizeSortField(req.query?.sortField);
    const sortDir = normalizeSortDir(req.query?.sortDir);

    const where = {};
    if (status) where.status = status;
    if (model && model !== "ALL") where.modelName = model;
    if (search) {
      where.OR = [
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { project: { title: { contains: search, mode: "insensitive" } } },
        { project: { company: { contains: search, mode: "insensitive" } } },
        { project: { jobKeyword: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [total, analyses, modelRows] = await prisma.$transaction([
      prisma.analysis.count({ where }),
      prisma.analysis.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          status: true,
          errorCode: true,
          modelName: true,
          modelProvider: true,
          responseTime: true,
          totalChars: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
          project: { select: { title: true, company: true, jobKeyword: true } },
          tokenUsages: { select: { totalTokens: true, cost: true } },
        },
      }),
      prisma.analysis.findMany({
        where: { modelName: { not: null } },
        distinct: ["modelName"],
        orderBy: { modelName: "asc" },
        select: { modelName: true },
        take: 200,
      }),
    ]);

    return res.status(200).json({
      rows: analyses.map(mapAnalysisRow),
      total,
      models: modelRows.map((row) => row.modelName).filter(Boolean),
    });
  } catch (error) {
    console.error("❌ [GET /api/admin/resume-analysis] 에러:", error);
    return res.status(500).json({
      error: "관리자 분석 목록 조회에 실패했습니다.",
      message: process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
}
