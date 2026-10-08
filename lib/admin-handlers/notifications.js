import {
  contentIdsBySettings,
  readPurchaseProductSettings,
  resolveProductForPaymentRecord,
} from "../entitlement-products.js";
import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";

/**
 * 관리자 알림함 — GET /api/admin/notifications?since=ISO
 * - 멘토링: 확정 대기(REQUESTED) 신청은 처리할 때까지 늘 센다(읽음과 무관).
 * - 결제·실패 분석: since 이후 새로 생긴 것. since 는 관리자가 알림함을 마지막으로 연 시각(브라우저가 기억).
 * 이메일·자소서 본문은 담지 않고, 화면이 상세 페이지로 이동할 id 만 준다.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_MS = DAY_MS;
const MAX_LOOKBACK_MS = 30 * DAY_MS;
const ITEM_LIMIT = 5;

/** 없거나 잘못된 since 는 24시간 전, 30일보다 오래된 값은 30일 전으로 자른다(조회 범위 제한). 미래 값은 지금으로. */
export function readSince(query, now = new Date()) {
  const raw = typeof query?.since === "string" ? new Date(query.since) : null;
  const floor = now.getTime() - MAX_LOOKBACK_MS;
  if (!raw || Number.isNaN(raw.getTime())) return new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
  return new Date(Math.min(Math.max(raw.getTime(), floor), now.getTime()));
}

export default createAdminHandler({ route: "api/admin/notifications", methods: ["GET"] }, async ({ req, res }) => {
  const since = readSince(req.query);
  const [mentoringCount, mentoringRows, paymentCount, paymentRows, failedCount, failedRows, productSettings] = await Promise.all([
    prisma.mentoringBooking.count({ where: { status: "REQUESTED" } }),
    prisma.mentoringBooking.findMany({
      where: { status: "REQUESTED" },
      orderBy: { createdAt: "desc" },
      take: ITEM_LIMIT,
      select: { id: true, sessionType: true, createdAt: true, slot: { select: { startsAt: true } } },
    }),
    prisma.paymentEntitlement.count({ where: { createdAt: { gte: since } } }),
    prisma.paymentEntitlement.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: ITEM_LIMIT,
      select: { id: true, userId: true, createdAt: true, rawEvent: true },
    }),
    prisma.analysis.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    prisma.analysis.findMany({
      where: { status: "FAILED", createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: ITEM_LIMIT,
      select: { id: true, createdAt: true, errorCode: true },
    }),
    readPurchaseProductSettings(prisma),
  ]);
  const contentIds = contentIdsBySettings(productSettings);

  return res.status(200).json({
    since: since.toISOString(),
    mentoringRequested: {
      count: mentoringCount,
      items: mentoringRows.map((row) => ({
        id: row.id,
        sessionType: row.sessionType,
        createdAt: row.createdAt,
        startsAt: row.slot?.startsAt ?? null,
      })),
    },
    payments: {
      count: paymentCount,
      items: paymentRows.map((row) => ({
        id: row.id,
        userId: row.userId,
        createdAt: row.createdAt,
        product: resolveProductForPaymentRecord(row.rawEvent, contentIds) ?? "UNKNOWN",
      })),
    },
    failedAnalyses: {
      count: failedCount,
      items: failedRows.map((row) => ({ id: row.id, createdAt: row.createdAt, errorCode: row.errorCode ?? null })),
    },
  });
});
