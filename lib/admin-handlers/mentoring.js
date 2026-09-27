import { createAdminHandler } from "./create-admin-handler.js";
import prisma from "../prisma.js";
import { isRecord } from "../sanitize.js";
import { sendRequestError } from "../request-errors.js";

/**
 * 관리자 — 커피챗·모의면접 슬롯과 신청 관리.
 *
 * - GET  /api/admin/mentoring          지난 14일 ~ 앞으로의 슬롯 전부(신청자 포함)
 * - POST /api/admin/mentoring          슬롯 열기 { startsAt, durationMin }
 * - PATCH /api/admin/mentoring/:id     { action: confirm | cancel | close | reopen }
 * - DELETE /api/admin/mentoring/:id    신청이 없는 슬롯만 삭제
 */

const DURATIONS = new Set([30, 40, 60]);
const PAST_WINDOW_DAYS = 14;
const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED"];

const SLOT_SELECT = {
  id: true, startsAt: true, durationMin: true, status: true, createdAt: true,
  bookings: {
    where: { status: { in: ACTIVE_STATUSES } },
    take: 1,
    select: {
      id: true, status: true, sessionType: true, message: true, createdAt: true,
      user: { select: { email: true, name: true } },
    },
  },
};

function serializeSlot(slot) {
  const booking = slot.bookings[0] ?? null;
  return {
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    durationMin: slot.durationMin,
    status: slot.status,
    booking: booking && {
      id: booking.id,
      status: booking.status,
      sessionType: booking.sessionType,
      message: booking.message,
      createdAt: booking.createdAt.toISOString(),
      userEmail: booking.user.email,
      userName: booking.user.name,
    },
  };
}

export function readSlotBody(body, now = new Date()) {
  if (!isRecord(body)) return null;
  const startsAt = typeof body.startsAt === "string" ? new Date(body.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime()) || startsAt <= now) return null;
  const durationMin = Number(body.durationMin);
  if (!DURATIONS.has(durationMin)) return null;
  return { startsAt, durationMin };
}

export const mentoringHandler = createAdminHandler(
  { route: "api/admin/mentoring", methods: ["GET", "POST"] },
  async ({ req, res, requestId }) => {
    if (req.method === "POST") {
      const input = readSlotBody(req.body);
      if (!input) return sendRequestError(res, 400, requestId);
      const slot = await prisma.mentoringSlot.create({ data: input, select: SLOT_SELECT });
      return res.status(201).json({ slot: serializeSlot(slot) });
    }

    const since = new Date(Date.now() - PAST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const slots = await prisma.mentoringSlot.findMany({
      where: { startsAt: { gte: since } },
      orderBy: { startsAt: "asc" },
      take: 200,
      select: SLOT_SELECT,
    });
    return res.status(200).json({ slots: slots.map(serializeSlot) });
  },
);

// 액션 → (신청 상태, 슬롯 상태). cancel 은 슬롯을 다시 열어 다른 사람이 잡을 수 있게 한다.
const ACTIONS = Object.freeze({
  confirm: { booking: "CONFIRMED", slot: "BOOKED", needsBooking: true },
  cancel: { booking: "CANCELLED", slot: "OPEN", needsBooking: true },
  close: { booking: null, slot: "CLOSED", needsBooking: false },
  reopen: { booking: null, slot: "OPEN", needsBooking: false },
});

export const mentoringDetailHandler = createAdminHandler(
  { route: "api/admin/mentoring/:id", methods: ["PATCH", "DELETE"] },
  async ({ req, res, requestId }) => {
    const id = typeof req.query?.id === "string" ? req.query.id : null;
    if (!id) return sendRequestError(res, 404, requestId);
    const slot = await prisma.mentoringSlot.findUnique({ where: { id }, select: SLOT_SELECT });
    if (!slot) return sendRequestError(res, 404, requestId);
    const booking = slot.bookings[0] ?? null;

    if (req.method === "DELETE") {
      if (booking) return sendRequestError(res, 409, requestId);
      await prisma.mentoringBooking.deleteMany({ where: { slotId: id } });
      await prisma.mentoringSlot.delete({ where: { id } });
      return res.status(200).json({ deleted: true });
    }

    const action = isRecord(req.body) && typeof req.body.action === "string" ? ACTIONS[req.body.action] : null;
    if (!action) return sendRequestError(res, 400, requestId);
    if (action.needsBooking && !booking) return sendRequestError(res, 409, requestId);
    // 신청이 붙어 있는 슬롯을 닫거나 다시 열면 신청 상태와 어긋난다. 먼저 취소하게 한다.
    if (!action.needsBooking && booking) return sendRequestError(res, 409, requestId);

    const writes = [prisma.mentoringSlot.update({ where: { id }, data: { status: action.slot } })];
    if (action.booking) {
      writes.push(prisma.mentoringBooking.update({ where: { id: booking.id }, data: { status: action.booking } }));
    }
    await prisma.$transaction(writes);

    const updated = await prisma.mentoringSlot.findUnique({ where: { id }, select: SLOT_SELECT });
    return res.status(200).json({ slot: serializeSlot(updated) });
  },
);

export default mentoringHandler;
