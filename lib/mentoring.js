import { ApiError, sendJson, withApiHandler } from "./api-handler.js";
import { requireActiveApplicationUser } from "./auth.js";
import prisma from "./prisma.js";
import { isRecord } from "./sanitize.js";

/**
 * 커피챗·모의면접 예약 — 사용자 쪽 API.
 *
 * - GET  /api/account/mentoring/slots     로그인 없이 열린 슬롯 목록(앞으로 30일)
 * - GET  /api/account/mentoring/bookings  내 신청 목록
 * - POST /api/account/mentoring/bookings  슬롯 하나를 골라 신청
 *
 * 한 슬롯에 두 명이 잡히지 않게 슬롯 상태를 OPEN → BOOKED 로 "조건부 갱신"하고, 갱신된 행이
 * 없으면 이미 나간 시간으로 본다. 결제(모의면접)는 사이트 밖이라 여기서는 다루지 않는다.
 */

export const SESSION_TYPES = Object.freeze(["RESUME_REVIEW", "COFFEE_CHAT", "MOCK_INTERVIEW"]);
export const MESSAGE_MIN_LENGTH = 10;
export const MESSAGE_MAX_LENGTH = 1000;
/** 한 사람이 동시에 잡아 둘 수 있는 신청 수. 노쇼·독점을 막는 최소한의 상한. */
export const ACTIVE_BOOKING_LIMIT = 2;
const OPEN_WINDOW_DAYS = 30;
const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED"];

export function openSlotsWhere(now = new Date()) {
  return {
    status: "OPEN",
    startsAt: { gt: now, lte: new Date(now.getTime() + OPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000) },
  };
}

function serializeSlot(slot) {
  return { id: slot.id, startsAt: slot.startsAt.toISOString(), durationMin: slot.durationMin };
}

function serializeBooking(booking) {
  return {
    id: booking.id,
    status: booking.status,
    sessionType: booking.sessionType,
    message: booking.message,
    createdAt: booking.createdAt.toISOString(),
    slot: serializeSlot(booking.slot),
  };
}

/** 신청 본문 검증. 잘못되면 null. */
export function readBookingBody(body) {
  if (!isRecord(body)) return null;
  const { slotId, sessionType, message } = body;
  if (typeof slotId !== "string" || !/^[0-9a-f-]{36}$/i.test(slotId)) return null;
  if (!SESSION_TYPES.includes(sessionType)) return null;
  if (typeof message !== "string") return null;
  const trimmed = message.trim();
  if (trimmed.length < MESSAGE_MIN_LENGTH || trimmed.length > MESSAGE_MAX_LENGTH) return null;
  return { slotId, sessionType, message: trimmed };
}

export function createMentoringSlotsHandler({ db = prisma, now = () => new Date() } = {}) {
  return async function slotsHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET") throw new ApiError("METHOD_NOT_ALLOWED", 405);
      const slots = await db.mentoringSlot.findMany({
        where: openSlotsWhere(now()),
        orderBy: { startsAt: "asc" },
        select: { id: true, startsAt: true, durationMin: true },
      });
      return sendJson(res, 200, { slots: slots.map(serializeSlot) }, requestId);
    });
  };
}

const BOOKING_SELECT = {
  id: true, status: true, sessionType: true, message: true, createdAt: true,
  slot: { select: { id: true, startsAt: true, durationMin: true } },
};

export function createMentoringBookingsHandler({
  db = prisma,
  now = () => new Date(),
  requireUser = (req) => requireActiveApplicationUser(req, db),
} = {}) {
  return async function bookingsHandler(req, res) {
    return withApiHandler(req, res, async (requestId) => {
      if (req.method !== "GET" && req.method !== "POST") throw new ApiError("METHOD_NOT_ALLOWED", 405);
      const { applicationUser } = await requireUser(req);

      if (req.method === "GET") {
        const bookings = await db.mentoringBooking.findMany({
          where: { userId: applicationUser.id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: BOOKING_SELECT,
        });
        return sendJson(res, 200, { bookings: bookings.map(serializeBooking) }, requestId);
      }

      const input = readBookingBody(req.body);
      if (!input) throw new ApiError("INVALID_REQUEST", 400);

      const active = await db.mentoringBooking.count({
        where: { userId: applicationUser.id, status: { in: ACTIVE_STATUSES } },
      });
      if (active >= ACTIVE_BOOKING_LIMIT) throw new ApiError("BOOKING_LIMIT_REACHED", 409);

      const booking = await db.$transaction(async (tx) => {
        const claimed = await tx.mentoringSlot.updateMany({
          where: { id: input.slotId, ...openSlotsWhere(now()) },
          data: { status: "BOOKED" },
        });
        if (claimed.count !== 1) throw new ApiError("SLOT_UNAVAILABLE", 409);
        return tx.mentoringBooking.create({
          data: {
            slotId: input.slotId,
            userId: applicationUser.id,
            sessionType: input.sessionType,
            message: input.message,
          },
          select: BOOKING_SELECT,
        });
      });

      return sendJson(res, 201, { booking: serializeBooking(booking) }, requestId);
    });
  };
}
