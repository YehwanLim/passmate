import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed, sendRequestError } from "../request-errors.js";

function mapAnalysis(analysis) {
  return {
    id: analysis.id, status: analysis.status, model_name: analysis.modelName ?? null,
    model_provider: analysis.modelProvider ?? null, ai_score: analysis.aiScore ?? null,
    created_at: analysis.createdAt,
    project: analysis.project ? { title: analysis.project.title, company: analysis.project.company ?? null } : null,
    token_usages: analysis.tokenUsages.map((usage) => ({ total_tokens: usage.totalTokens, cost: usage.cost ?? null })),
  };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);
    const id = String(req.query?.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return sendRequestError(res, 400, requestId);

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, name: true, avatarUrl: true, role: true, createdAt: true, updatedAt: true,
        _count: { select: { analyses: true, projects: true, feedbacks: true } },
        analyses: {
          orderBy: { createdAt: "desc" }, take: 20,
          select: {
            id: true, status: true, modelName: true, modelProvider: true, aiScore: true, createdAt: true,
            project: { select: { title: true, company: true } },
            tokenUsages: { select: { totalTokens: true, cost: true } },
          },
        },
        feedbacks: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, rating: true, comment: true, createdAt: true } },
      },
    });
    if (!user) return sendRequestError(res, 404, requestId);
    const usages = await prisma.tokenUsage.findMany({
      where: { analysis: { userId: id } }, select: { totalTokens: true, cost: true }, take: 10_000,
    });
    return res.status(200).json({
      id: user.id, email: user.email, name: user.name ?? null, profile_image: user.avatarUrl ?? null,
      provider: null, role: user.role, created_at: user.createdAt, updated_at: user.updatedAt,
      analysis_count: user._count.analyses, project_count: user._count.projects, feedback_count: user._count.feedbacks,
      total_tokens: usages.reduce((sum, usage) => sum + usage.totalTokens, 0),
      total_ai_cost: usages.reduce((sum, usage) => sum + (usage.cost ?? 0), 0),
      analyses: user.analyses.map(mapAnalysis),
      feedbacks: user.feedbacks.map((feedback) => ({
        id: feedback.id, rating: feedback.rating, comment: feedback.comment ?? null, created_at: feedback.createdAt,
      })),
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/users/[id]");
  }
}
