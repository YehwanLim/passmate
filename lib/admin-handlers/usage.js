import { requireAdministrator } from "../auth.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed, sendRequestError } from "../request-errors.js";

function kstDayStart(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000);
}

function kstLabel(value) {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function lastSevenLabels(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => kstLabel(new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000)));
}

async function aiUsagePayload() {
  const now = new Date();
  const todayStart = kstDayStart(now);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [todayTokens, todayAnalyses, weekTokens] = await Promise.all([
    prisma.tokenUsage.findMany({ where: { createdAt: { gte: todayStart } }, select: { promptTokens: true, completionTokens: true, totalTokens: true, cost: true, createdAt: true } }),
    prisma.analysis.findMany({ where: { createdAt: { gte: todayStart } }, select: { status: true, responseTime: true } }),
    prisma.tokenUsage.findMany({ where: { createdAt: { gte: weekStart } }, select: { modelName: true, modelProvider: true, totalTokens: true, cost: true, createdAt: true } }),
  ]);
  const modelUsage = new Map();
  weekTokens.forEach((row) => {
    const key = `${row.modelProvider}:${row.modelName}`;
    const value = modelUsage.get(key) ?? { modelName: row.modelName, provider: row.modelProvider, calls: 0, tokens: 0, cost: 0 };
    value.calls += 1; value.tokens += row.totalTokens; value.cost += row.cost ?? 0; modelUsage.set(key, value);
  });
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, "0")}시`, tokens: 0, cost: 0 }));
  todayTokens.forEach((row) => {
    const hour = (new Date(row.createdAt).getUTCHours() + 9) % 24;
    hourly[hour].tokens += row.totalTokens; hourly[hour].cost += row.cost ?? 0;
  });
  const labels = lastSevenLabels(now);
  const dailyMap = new Map(labels.map((label) => [label, { tokens: 0, cost: 0 }]));
  weekTokens.forEach((row) => {
    const value = dailyMap.get(kstLabel(row.createdAt));
    if (value) { value.tokens += row.totalTokens; value.cost += row.cost ?? 0; }
  });
  const latencyRows = todayAnalyses.filter((row) => typeof row.responseTime === "number" && row.responseTime > 0);
  return {
    summary: {
      todayTokens: {
        prompt: todayTokens.reduce((sum, row) => sum + row.promptTokens, 0),
        completion: todayTokens.reduce((sum, row) => sum + row.completionTokens, 0),
        total: todayTokens.reduce((sum, row) => sum + row.totalTokens, 0),
      },
      todayCost: todayTokens.reduce((sum, row) => sum + (row.cost ?? 0), 0),
      avgResponseTimeMs: latencyRows.length ? Math.round(latencyRows.reduce((sum, row) => sum + row.responseTime, 0) / latencyRows.length) : 0,
      failureRate: todayAnalyses.length ? Math.round((todayAnalyses.filter((row) => row.status === "FAILED").length / todayAnalyses.length) * 100) : 0,
    },
    modelUsage: Array.from(modelUsage.values()).sort((a, b) => b.cost - a.cost),
    hourlyUsage: hourly,
    dailyUsage: labels.map((date) => ({ date, ...dailyMap.get(date) })),
  };
}

async function modelsPayload() {
  const now = new Date();
  const todayStart = kstDayStart(now);
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [templates, usageRows, todayUsageRows, todayAnalysesRows, logs] = await Promise.all([
    prisma.promptTemplate.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: { modelName: true, modelProvider: true, maxTokens: true, temperature: true, isActive: true, isDefault: true, createdAt: true } }),
    prisma.tokenUsage.findMany({ where: { createdAt: { gte: monthStart } }, orderBy: { createdAt: "desc" }, take: 5000, select: { modelName: true, modelProvider: true, totalTokens: true, cost: true, latencyMs: true, isSuccess: true, httpStatus: true, createdAt: true } }),
    prisma.tokenUsage.findMany({ where: { createdAt: { gte: todayStart } }, orderBy: { createdAt: "desc" }, take: 5000, select: { modelName: true, modelProvider: true, totalTokens: true, cost: true, latencyMs: true, isSuccess: true, createdAt: true } }),
    prisma.analysis.findMany({ where: { createdAt: { gte: todayStart } }, take: 5000, select: { status: true, responseTime: true, modelName: true, modelProvider: true, createdAt: true } }),
    prisma.tokenUsage.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: { id: true, modelName: true, modelProvider: true, totalTokens: true, cost: true, latencyMs: true, isSuccess: true, httpStatus: true, createdAt: true } }),
  ]);
  const toSnake = (row) => ({
    ...row, model_name: row.modelName, model_provider: row.modelProvider, max_tokens: row.maxTokens,
    is_active: row.isActive, is_default: row.isDefault, created_at: row.createdAt,
    total_tokens: row.totalTokens, latency_ms: row.latencyMs, is_success: row.isSuccess, http_status: row.httpStatus,
    response_time_ms: row.responseTime,
  });
  return { templates: templates.map(toSnake), usageRows: usageRows.map(toSnake), todayUsageRows: todayUsageRows.map(toSnake), todayAnalysesRows: todayAnalysesRows.map(toSnake), logs: logs.map(toSnake) };
}

function periodStart(period) {
  const now = new Date();
  if (period === "today") return kstDayStart(now);
  return new Date(now.getTime() - (period === "30d" ? 30 : 7) * 24 * 60 * 60 * 1000);
}

async function funnelPayload(period) {
  const start = periodStart(period);
  const [signedUpUsers, projects, analyses] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: start } } }),
    prisma.project.findMany({ where: { createdAt: { gte: start } }, select: { userId: true } }),
    prisma.analysis.findMany({ where: { createdAt: { gte: start } }, orderBy: { createdAt: "asc" }, take: 10_000, select: { userId: true, status: true, responseTime: true, createdAt: true } }),
  ]);
  return { signedUpUsers, projects: projects.map((row) => ({ user_id: row.userId })), analyses: analyses.map((row) => ({ user_id: row.userId, status: row.status, response_time_ms: row.responseTime, created_at: row.createdAt })) };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);
    const view = String(req.query?.view ?? "ai");
    if (view === "ai") return res.status(200).json(await aiUsagePayload());
    if (view === "models") return res.status(200).json(await modelsPayload());
    if (view === "funnel") {
      const period = ["today", "7d", "30d"].includes(req.query?.period) ? req.query.period : "7d";
      return res.status(200).json(await funnelPayload(period));
    }
    return sendRequestError(res, 400, requestId);
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/usage");
  }
}
