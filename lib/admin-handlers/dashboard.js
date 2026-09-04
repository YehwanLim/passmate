import { requireAdministrator } from "../auth.js";
import { resolveProductForPaymentRecord } from "../entitlement-products.js";
import prisma from "../prisma.js";
import { handleRequestError, requestIdFor, sendMethodNotAllowed } from "../request-errors.js";

function kstDayStart(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 60 * 60 * 1000);
}

function kstLabel(value) {
  const date = new Date(new Date(value).getTime() + 9 * 60 * 60 * 1000);
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function lastSevenLabels(now = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    return kstLabel(date);
  });
}

function countByKstDay(rows, labels) {
  const counts = new Map(labels.map((label) => [label, 0]));
  rows.forEach(({ createdAt }) => {
    const label = kstLabel(createdAt);
    if (counts.has(label)) counts.set(label, counts.get(label) + 1);
  });
  return labels.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

// 금액은 Groble 상품 설정이 진실이라 저장하지 않는다. 여기서는 건수만 세고,
// 추정 매출은 가격을 아는 클라이언트(client/src/lib/pricing.ts)가 계산한다.
function summarizePayments(payments, todayStart) {
  const contentIds = {
    premiumContentId: process.env.GROBLE_PREMIUM_CONTENT_ID,
    singleContentId: process.env.GROBLE_SINGLE_CONTENT_ID,
  };
  const byProduct = { SINGLE: 0, TRIPLE: 0, UNKNOWN: 0 };
  let today = 0;
  payments.forEach(({ createdAt, rawEvent }) => {
    byProduct[resolveProductForPaymentRecord(rawEvent, contentIds) ?? "UNKNOWN"] += 1;
    if (createdAt >= todayStart) today += 1;
  });
  return { total: payments.length, today, byProduct };
}

export default async function handler(req, res) {
  const requestId = requestIdFor(req);
  try {
    await requireAdministrator(req, prisma);
    if (req.method !== "GET") return sendMethodNotAllowed(res, requestId);

    const now = new Date();
    const todayStart = kstDayStart(now);
    const recentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const onlineStart = new Date(now.getTime() - 30 * 60 * 1000);
    const labels = lastSevenLabels(now);
    const [todaySignups, todayAnalyses, costs, visitors, online, signups, analyses, recentActivity, payments] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.analysis.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.tokenUsage.findMany({ where: { createdAt: { gte: todayStart } }, select: { cost: true } }),
      prisma.analysis.findMany({ where: { createdAt: { gte: todayStart } }, select: { userId: true } }),
      prisma.analysis.findMany({ where: { createdAt: { gte: onlineStart } }, select: { userId: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: recentStart } }, select: { createdAt: true } }),
      prisma.analysis.findMany({ where: { createdAt: { gte: recentStart } }, select: { createdAt: true } }),
      prisma.analysis.findMany({
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, status: true, createdAt: true, modelName: true, user: { select: { email: true } } },
      }),
      prisma.paymentEntitlement.findMany({ select: { createdAt: true, rawEvent: true }, take: 10_000 }),
    ]);

    return res.status(200).json({
      kpi: {
        todayVisitors: new Set(visitors.map(({ userId }) => userId)).size,
        todaySignups,
        todayAnalyses,
        todayAiCost: costs.reduce((sum, row) => sum + (row.cost ?? 0), 0),
        onlineUsers: new Set(online.map(({ userId }) => userId)).size,
      },
      paymentSummary: summarizePayments(payments, todayStart),
      signupChart: countByKstDay(signups, labels),
      analysisChart: countByKstDay(analyses, labels),
      recentActivity: recentActivity.map((row) => ({
        id: row.id, userEmail: row.user?.email ?? "–", status: row.status,
        createdAt: row.createdAt, modelName: row.modelName ?? null,
      })),
    });
  } catch (error) {
    return handleRequestError(res, error, requestId, "api/admin/dashboard");
  }
}
