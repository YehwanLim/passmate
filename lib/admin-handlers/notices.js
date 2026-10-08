import { recordAuditEvent } from "../audit-log.js";
import { sendRequestError } from "../request-errors.js";
import { readNoticeBody } from "../site-notices.js";
import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";

/**
 * 관리자 — 사이트 공지(팝업·배너).
 * - GET  /api/admin/notices        전부(최근 만든 순, 최대 100)
 * - POST /api/admin/notices        만들기 { kind, title, body?, linkUrl?, linkLabel?, imageUrl?, active?, startsAt?, endsAt? }
 * - PATCH /api/admin/notices/:id   고치기(온 필드만)·켜기/끄기
 * - DELETE /api/admin/notices/:id  지우기
 */
const LIST_LIMIT = 100;

function audit({ administrator, requestId, outcome, targetId }) {
  return recordAuditEvent({
    actorId: administrator?.applicationUser?.id ?? null,
    db: prisma,
    outcome,
    requestId,
    targetId,
    targetType: "site_notice",
  });
}

export const noticesHandler = createAdminHandler(
  { route: "api/admin/notices", methods: ["GET", "POST"] },
  async ({ administrator, req, res, requestId }) => {
    if (req.method === "POST") {
      const data = readNoticeBody(req.body);
      if (!data) return sendRequestError(res, 400, requestId);
      const notice = await prisma.siteNotice.create({ data });
      await audit({ administrator, requestId, outcome: "NOTICE_CREATED", targetId: notice.id });
      return res.status(201).json({ notice });
    }
    const notices = await prisma.siteNotice.findMany({ orderBy: { createdAt: "desc" }, take: LIST_LIMIT });
    return res.status(200).json({ notices });
  },
);

export const noticeDetailHandler = createAdminHandler(
  { route: "api/admin/notices/:id", methods: ["PATCH", "DELETE"] },
  async ({ administrator, req, res, requestId }) => {
    const id = typeof req.query?.id === "string" ? req.query.id : null;
    const existing = id ? await prisma.siteNotice.findUnique({ where: { id } }) : null;
    if (!existing) return sendRequestError(res, 404, requestId);

    if (req.method === "DELETE") {
      await prisma.siteNotice.delete({ where: { id } });
      await audit({ administrator, requestId, outcome: "NOTICE_DELETED", targetId: id });
      return res.status(200).json({ deleted: true });
    }

    const data = readNoticeBody(req.body, { partial: true });
    if (!data) return sendRequestError(res, 400, requestId);
    const startsAt = data.startsAt !== undefined ? data.startsAt : existing.startsAt;
    const endsAt = data.endsAt !== undefined ? data.endsAt : existing.endsAt;
    if (startsAt && endsAt && startsAt >= endsAt) return sendRequestError(res, 400, requestId);

    const notice = await prisma.siteNotice.update({ where: { id }, data });
    await audit({ administrator, requestId, outcome: "NOTICE_UPDATED", targetId: id });
    return res.status(200).json({ notice });
  },
);
