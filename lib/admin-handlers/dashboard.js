import { requireAdministrator } from "../auth.js";
import {
  PURCHASE_PRODUCT_KEYS,
  contentIdsBySettings,
  readPurchaseProductSettings,
  resolveProductForPaymentRecord,
} from "../entitlement-products.js";
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

export const DASHBOARD_RANGE_DAYS = Object.freeze([7, 30, 90]);
const DEFAULT_RANGE_DAYS = 7;
const ONLINE_WINDOW_MS = 30 * 60 * 1000;
const VISIT_ROW_CAP = 200_000;

/** 차트 기간(일). 허용 목록 밖의 값은 기본 7일로 돌려 쿼리 범위가 임의로 커지지 않게 한다. */
export function readRangeDays(query) {
  const days = Number.parseInt(query?.days, 10);
  return DASHBOARD_RANGE_DAYS.includes(days) ? days : DEFAULT_RANGE_DAYS;
}

function lastLabels(days, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - 1 - index) * 24 * 60 * 60 * 1000);
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

/**
 * 방문은 한 사람이 여러 페이지를 보므로 "고유 방문자"(visitorId 기준)와 "페이지뷰"(행 수)를
 * 따로 센다. 방문자 ID 는 브라우저가 만든 무작위 값이라 같은 사람이 브라우저를 바꾸면 둘로 잡힌다.
 */
export function summarizeVisits(visits, { todayStart, onlineStart, labels }) {
  const byDay = new Map(labels.map((label) => [label, { visitors: new Set(), pageViews: 0 }]));
  const todayVisitors = new Set();
  const onlineVisitors = new Set();
  let todayPageViews = 0;

  visits.forEach(({ visitorId, createdAt }) => {
    const day = byDay.get(kstLabel(createdAt));
    if (day) {
      day.visitors.add(visitorId);
      day.pageViews += 1;
    }
    if (createdAt >= todayStart) {
      todayVisitors.add(visitorId);
      todayPageViews += 1;
    }
    if (createdAt >= onlineStart) onlineVisitors.add(visitorId);
  });

  return {
    todayVisitors: todayVisitors.size,
    todayPageViews,
    onlineUsers: onlineVisitors.size,
    chart: labels.map((date) => {
      const day = byDay.get(date);
      return { date, visitors: day.visitors.size, pageViews: day.pageViews };
    }),
  };
}

// 금액은 Groble 상품 설정이 진실이라 저장하지 않는다. 여기서는 건수만 세고,
// 추정 매출은 가격을 아는 클라이언트(client/src/lib/pricing.ts)가 계산한다.
function summarizePayments(payments, todayStart, contentIds) {
  const byProduct = Object.fromEntries([...PURCHASE_PRODUCT_KEYS, "UNKNOWN"].map((key) => [key, 0]));
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
    const days = readRangeDays(req.query);
    const todayStart = kstDayStart(now);
    const recentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const onlineStart = new Date(now.getTime() - ONLINE_WINDOW_MS);
    const labels = lastLabels(days, now);
    const [todaySignups, todayAnalyses, costs, visits, signups, analyses, recentActivity, payments, productSettings] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.analysis.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.tokenUsage.findMany({ where: { createdAt: { gte: todayStart } }, select: { cost: true } }),
      // 방문은 분석과 달리 로그인 없이도 쌓이므로 사이트에 들어오기만 해도 여기서 잡힌다.
      prisma.siteVisit.findMany({
        where: { createdAt: { gte: recentStart } },
        select: { visitorId: true, createdAt: true },
        take: VISIT_ROW_CAP,
      }),
      prisma.user.findMany({ where: { createdAt: { gte: recentStart } }, select: { createdAt: true } }),
      prisma.analysis.findMany({ where: { createdAt: { gte: recentStart } }, select: { createdAt: true } }),
      prisma.analysis.findMany({
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, status: true, createdAt: true, modelName: true, user: { select: { email: true } } },
      }),
      prisma.paymentEntitlement.findMany({ select: { createdAt: true, rawEvent: true }, take: 10_000 }),
      readPurchaseProductSettings(prisma),
    ]);
    const contentIds = contentIdsBySettings(productSettings);
    const visitSummary = summarizeVisits(visits, { todayStart, onlineStart, labels });

    return res.status(200).json({
      range: { days },
      kpi: {
        todayVisitors: visitSummary.todayVisitors,
        todayPageViews: visitSummary.todayPageViews,
        todaySignups,
        todayAnalyses,
        todayAiCost: costs.reduce((sum, row) => sum + (row.cost ?? 0), 0),
        onlineUsers: visitSummary.onlineUsers,
      },
      paymentSummary: summarizePayments(payments, todayStart, contentIds),
      visitorChart: visitSummary.chart,
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
