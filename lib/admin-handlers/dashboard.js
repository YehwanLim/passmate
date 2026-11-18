import {
  PURCHASE_PRODUCT_KEYS,
  contentIdsBySettings,
  readPurchaseProductSettings,
  resolveProductForPaymentRecord,
} from "../billing/entitlement-products.js";
import { inPeriod, kstDayStart, readPeriod } from "./admin-period.js";
import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";
import { ENGAGED_TIME_EVENT } from "../site-visits.js";

const ONLINE_WINDOW_MS = 30 * 60 * 1000;
export const VISIT_ROW_CAP = 200_000;

function emptyByProduct() {
  return Object.fromEntries([...PURCHASE_PRODUCT_KEYS, "UNKNOWN"].map((key) => [key, 0]));
}

function countByBucket(rows, period) {
  const counts = new Map(period.labels.map((label) => [label, 0]));
  rows.forEach(({ createdAt }) => {
    if (!inPeriod(period, createdAt)) return;
    const label = period.bucketOf(createdAt);
    if (counts.has(label)) counts.set(label, counts.get(label) + 1);
  });
  return period.labels.map((date) => ({ date, count: counts.get(date) ?? 0 }));
}

/**
 * 방문은 한 사람이 여러 페이지를 보므로 "고유 방문자"(visitorId 기준)와 "페이지뷰"(행 수)를
 * 따로 센다. 방문자 ID 는 브라우저가 만든 무작위 값이라 같은 사람이 브라우저를 바꾸면 둘로 잡힌다.
 * 칸(하루·한 달)마다 고유 방문자를 세므로 월별 칸은 그 달의 고유 방문자다.
 */
export function summarizeVisits(visits, { todayStart, onlineStart, period }) {
  const byBucket = new Map(period.labels.map((label) => [label, { visitors: new Set(), pageViews: 0 }]));
  const todayVisitors = new Set();
  const onlineVisitors = new Set();
  let todayPageViews = 0;

  visits.forEach(({ visitorId, createdAt }) => {
    if (inPeriod(period, createdAt)) {
      const bucket = byBucket.get(period.bucketOf(createdAt));
      if (bucket) {
        bucket.visitors.add(visitorId);
        bucket.pageViews += 1;
      }
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
    chart: period.labels.map((date) => {
      const bucket = byBucket.get(date);
      return { date, visitors: bucket.visitors.size, pageViews: bucket.pageViews };
    }),
  };
}

/**
 * 관리자 계정이 로그인한 채 남긴 방문이 하나라도 있는 방문자 ID(탭 세션)는 통째로 뺀다.
 * 로그인 전에 익명으로 본 페이지도 같은 세션이라 함께 빠진다. 앞으로의 운영자 방문은
 * 클라이언트가 아예 보내지 않지만(client/src/lib/internalTraffic.ts), 그 전에 쌓인 기록은 여기서 거른다.
 */
export function excludeAdminVisits(visits, adminUserIds) {
  if (adminUserIds.size === 0) return visits;
  const adminVisitorIds = new Set();
  visits.forEach(({ visitorId, userId }) => {
    if (userId && adminUserIds.has(userId)) adminVisitorIds.add(visitorId);
  });
  if (adminVisitorIds.size === 0) return visits;
  return visits.filter(({ visitorId }) => !adminVisitorIds.has(visitorId));
}

// 로그인이 필요한 앱 화면. 사람은 보통 랜딩·공고·가이드를 거쳐 오지만, 자동 프로그램은 링크 없이
// 이 주소로 곧장 들어와 로그인 화면으로 튕기고 1~3초 만에 끝난다(11-10 2분에 51건 몰린 사례).
const BOT_ENTRY_PATHS = new Set(["/analyze", "/company-analysis", "/my/new"]);
const BOT_FOLLOW_PATHS = new Set([...BOT_ENTRY_PATHS, "/login"]);

/**
 * 사람이 아닐 가능성이 높은 방문자 ID(탭 세션). 아래를 모두 만족해야 봇으로 본다.
 * - 첫 화면이 앱 화면이고, 세션 안에서 본 화면이 전부 앱 화면·로그인 화면뿐
 * - 유입원(referrer·utm)이 하나도 없음
 * - 로그인한 적 없음
 * - 머문 시간(engaged_time) 말고는 아무 행동 기록이 없음(activeVisitorIds 에 없음)
 * 북마크로 /analyze 에 바로 와서 아무것도 안 하고 나간 사람도 빠질 수 있지만, 그런 방문은 집계 의미가 적다.
 */
export function likelyBotVisitorIds(visits, activeVisitorIds = new Set()) {
  const sessions = new Map();
  visits.forEach((row) => {
    const session = sessions.get(row.visitorId);
    if (!session) {
      sessions.set(row.visitorId, { first: row, rows: [row] });
      return;
    }
    session.rows.push(row);
    if (row.createdAt < session.first.createdAt) session.first = row;
  });
  const bots = new Set();
  sessions.forEach(({ first, rows }, visitorId) => {
    if (activeVisitorIds.has(visitorId)) return;
    if (!BOT_ENTRY_PATHS.has(first.path)) return;
    const looksLikeBot = rows.every(
      (row) => BOT_FOLLOW_PATHS.has(row.path) && !row.referrer && !row.utmSource && !row.userId,
    );
    if (looksLikeBot) bots.add(visitorId);
  });
  return bots;
}

// 금액은 Groble 상품 설정이 진실이라 저장하지 않는다. 여기서는 건수만 세고,
// 추정 매출은 가격을 아는 클라이언트(client/src/lib/pricing.ts)가 계산한다.
function summarizePayments(payments, todayStart, contentIds) {
  const byProduct = emptyByProduct();
  let today = 0;
  payments.forEach(({ createdAt, rawEvent }) => {
    byProduct[resolveProductForPaymentRecord(rawEvent, contentIds) ?? "UNKNOWN"] += 1;
    if (createdAt >= todayStart) today += 1;
  });
  return { total: payments.length, today, byProduct };
}

/** 칸별 결제 건수와 상품별 건수(클라이언트가 추정 매출을 계산한다). */
export function paymentChart(payments, period, contentIds) {
  const buckets = new Map(period.labels.map((label) => [label, { count: 0, byProduct: emptyByProduct() }]));
  payments.forEach(({ createdAt, rawEvent }) => {
    if (!inPeriod(period, createdAt)) return;
    const bucket = buckets.get(period.bucketOf(createdAt));
    if (!bucket) return;
    bucket.count += 1;
    bucket.byProduct[resolveProductForPaymentRecord(rawEvent, contentIds) ?? "UNKNOWN"] += 1;
  });
  return period.labels.map((date) => ({ date, ...buckets.get(date) }));
}

/** 칸별 AI 비용 합(USD). */
export function aiCostChart(costs, period) {
  const totals = new Map(period.labels.map((label) => [label, 0]));
  costs.forEach(({ createdAt, cost }) => {
    if (!inPeriod(period, createdAt)) return;
    const label = period.bucketOf(createdAt);
    if (totals.has(label)) totals.set(label, totals.get(label) + (cost ?? 0));
  });
  return period.labels.map((date) => ({ date, cost: totals.get(date) ?? 0 }));
}

export default createAdminHandler({ route: "api/admin/dashboard", methods: ["GET"] }, async ({ req, res }) => {
  const now = new Date();
  const period = readPeriod(req.query, now);
  const todayStart = kstDayStart(now);
  // 지난주를 골라도 오늘 카드는 오늘 기준이어야 하므로 오늘까지 함께 읽고, 표는 칸으로 거른다.
  const queryStart = new Date(Math.min(period.start.getTime(), todayStart.getTime()));
  const onlineStart = new Date(now.getTime() - ONLINE_WINDOW_MS);
  const [todaySignups, todayAnalyses, costs, rawVisits, signups, analyses, recentActivity, payments, productSettings, admins, activeEvents] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.analysis.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.tokenUsage.findMany({ where: { createdAt: { gte: queryStart } }, select: { cost: true, createdAt: true } }),
    // 방문은 분석과 달리 로그인 없이도 쌓이므로 사이트에 들어오기만 해도 여기서 잡힌다.
    prisma.siteVisit.findMany({
      where: { createdAt: { gte: queryStart } },
      select: { visitorId: true, userId: true, path: true, referrer: true, utmSource: true, createdAt: true },
      take: VISIT_ROW_CAP,
    }),
    prisma.user.findMany({ where: { createdAt: { gte: period.start } }, select: { createdAt: true } }),
    prisma.analysis.findMany({ where: { createdAt: { gte: period.start } }, select: { createdAt: true } }),
    prisma.analysis.findMany({
      orderBy: { createdAt: "desc" }, take: 10,
      select: { id: true, status: true, createdAt: true, modelName: true, user: { select: { email: true } } },
    }),
    prisma.paymentEntitlement.findMany({ select: { createdAt: true, rawEvent: true }, take: 10_000 }),
    readPurchaseProductSettings(prisma),
    prisma.user.findMany({ where: { role: "admin" }, select: { id: true } }),
    // 머문 시간 말고 뭔가 누른 세션은 사람이다(봇 판별에서 제외).
    prisma.clientEvent.findMany({
      where: { createdAt: { gte: queryStart }, name: { not: ENGAGED_TIME_EVENT } },
      select: { visitorId: true },
      distinct: ["visitorId"],
    }),
  ]);
  const humanVisits = excludeAdminVisits(rawVisits, new Set(admins.map((row) => row.id).filter(Boolean)));
  const bots = likelyBotVisitorIds(humanVisits, new Set(activeEvents.map((row) => row.visitorId)));
  const visits = bots.size === 0 ? humanVisits : humanVisits.filter((row) => !bots.has(row.visitorId));
  const contentIds = contentIdsBySettings(productSettings);
  const visitSummary = summarizeVisits(visits, { todayStart, onlineStart, period });
  const todayCosts = costs.filter((row) => row.createdAt >= todayStart);

  return res.status(200).json({
    range: { period: period.key },
    kpi: {
      todayVisitors: visitSummary.todayVisitors,
      todayPageViews: visitSummary.todayPageViews,
      todaySignups,
      todayAnalyses,
      todayAiCost: todayCosts.reduce((sum, row) => sum + (row.cost ?? 0), 0),
      onlineUsers: visitSummary.onlineUsers,
    },
    paymentSummary: summarizePayments(payments, todayStart, contentIds),
    visitorChart: visitSummary.chart,
    signupChart: countByBucket(signups, period),
    analysisChart: countByBucket(analyses, period),
    paymentChart: paymentChart(payments, period, contentIds),
    aiCostChart: aiCostChart(costs, period),
    recentActivity: recentActivity.map((row) => ({
      id: row.id, userEmail: row.user?.email ?? "–", status: row.status,
      createdAt: row.createdAt, modelName: row.modelName ?? null,
    })),
  });
});
