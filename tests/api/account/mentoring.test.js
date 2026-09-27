import { describe, expect, it, vi } from "vitest";

import { AuthorizationError } from "../../../lib/auth.js";
import {
  ACTIVE_BOOKING_LIMIT,
  createMentoringBookingsHandler,
  createMentoringSlotsHandler,
  readBookingBody,
} from "../../../lib/mentoring.js";
import { createAccountRoutesHandler } from "../../../api/account/[...route].js";
import { createResponse } from "../../helpers/http.js";

const NOW = new Date("2026-09-25T09:00:00.000Z");
const SLOT_ID = "33333333-3333-4333-8333-333333333333";
const USER = { applicationUser: { id: "11111111-1111-4111-8111-111111111111", email: "u@example.com", role: "user" } };
const SLOT = { id: SLOT_ID, startsAt: new Date("2026-09-27T11:00:00.000Z"), durationMin: 40 };

function createDb() {
  const db = {
    mentoringSlot: { findMany: vi.fn(), updateMany: vi.fn() },
    mentoringBooking: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  };
  db.$transaction = vi.fn(async (work) => work(db));
  return db;
}

describe("GET /api/account/mentoring/slots", () => {
  it("로그인 없이 앞으로 30일 안의 OPEN 슬롯만 시간순으로 준다", async () => {
    const db = createDb();
    db.mentoringSlot.findMany.mockResolvedValue([SLOT]);
    const handler = createMentoringSlotsHandler({ db, now: () => NOW });
    const res = createResponse();

    await handler({ method: "GET", headers: {} }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ slots: [{ id: SLOT_ID, startsAt: "2026-09-27T11:00:00.000Z", durationMin: 40 }] });
    const where = db.mentoringSlot.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("OPEN");
    expect(where.startsAt.gt).toEqual(NOW);
    expect(where.startsAt.lte.getTime() - NOW.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("POST 는 405", async () => {
    const handler = createMentoringSlotsHandler({ db: createDb(), now: () => NOW });
    const res = createResponse();
    await handler({ method: "POST", headers: {} }, res);
    expect(res.statusCode).toBe(405);
  });
});

describe("POST /api/account/mentoring/bookings", () => {
  const body = { slotId: SLOT_ID, sessionType: "COFFEE_CHAT", message: "PM 직무 지원 전략이 고민입니다." };

  it("로그인이 없으면 401 이고 아무것도 쓰지 않는다", async () => {
    const db = createDb();
    const handler = createMentoringBookingsHandler({
      db, now: () => NOW,
      requireUser: async () => { throw new AuthorizationError("AUTHENTICATION_REQUIRED", 401, "private"); },
    });
    const res = createResponse();
    await handler({ method: "POST", headers: {}, body }, res);
    expect(res.statusCode).toBe(401);
    expect(db.mentoringSlot.updateMany).not.toHaveBeenCalled();
  });

  it("슬롯을 OPEN → BOOKED 로 조건부 갱신한 뒤 신청을 만든다", async () => {
    const db = createDb();
    db.mentoringBooking.count.mockResolvedValue(0);
    db.mentoringSlot.updateMany.mockResolvedValue({ count: 1 });
    db.mentoringBooking.create.mockResolvedValue({
      id: "b1", status: "REQUESTED", sessionType: "COFFEE_CHAT", message: body.message,
      createdAt: NOW, slot: SLOT,
    });
    const handler = createMentoringBookingsHandler({ db, now: () => NOW, requireUser: async () => USER });
    const res = createResponse();

    await handler({ method: "POST", headers: {}, body }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body.booking).toEqual(expect.objectContaining({ id: "b1", status: "REQUESTED", slot: expect.objectContaining({ id: SLOT_ID }) }));
    const claim = db.mentoringSlot.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual(expect.objectContaining({ id: SLOT_ID, status: "OPEN" }));
    expect(claim.data).toEqual({ status: "BOOKED" });
    expect(db.mentoringBooking.create.mock.calls[0][0].data).toEqual({
      slotId: SLOT_ID, userId: USER.applicationUser.id, sessionType: "COFFEE_CHAT", message: body.message,
    });
  });

  it("이미 잡힌(또는 지난) 슬롯이면 409 SLOT_UNAVAILABLE 이고 신청을 만들지 않는다", async () => {
    const db = createDb();
    db.mentoringBooking.count.mockResolvedValue(0);
    db.mentoringSlot.updateMany.mockResolvedValue({ count: 0 });
    const handler = createMentoringBookingsHandler({ db, now: () => NOW, requireUser: async () => USER });
    const res = createResponse();

    await handler({ method: "POST", headers: {}, body }, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("SLOT_UNAVAILABLE");
    expect(db.mentoringBooking.create).not.toHaveBeenCalled();
  });

  it("진행 중 신청이 상한이면 409 BOOKING_LIMIT_REACHED", async () => {
    const db = createDb();
    db.mentoringBooking.count.mockResolvedValue(ACTIVE_BOOKING_LIMIT);
    const handler = createMentoringBookingsHandler({ db, now: () => NOW, requireUser: async () => USER });
    const res = createResponse();
    await handler({ method: "POST", headers: {}, body }, res);
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("BOOKING_LIMIT_REACHED");
    expect(db.mentoringSlot.updateMany).not.toHaveBeenCalled();
  });

  it("본문 검증: 세션 종류·메시지 길이·슬롯 ID", () => {
    expect(readBookingBody(body)).toEqual(body);
    expect(readBookingBody({ ...body, sessionType: "PARTY" })).toBeNull();
    expect(readBookingBody({ ...body, message: "짧음" })).toBeNull();
    expect(readBookingBody({ ...body, message: "a".repeat(1001) })).toBeNull();
    expect(readBookingBody({ ...body, slotId: "nope" })).toBeNull();
    expect(readBookingBody(null)).toBeNull();
  });

  it("GET 은 내 신청만 최신순으로 준다", async () => {
    const db = createDb();
    db.mentoringBooking.findMany.mockResolvedValue([]);
    const handler = createMentoringBookingsHandler({ db, now: () => NOW, requireUser: async () => USER });
    const res = createResponse();
    await handler({ method: "GET", headers: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(db.mentoringBooking.findMany.mock.calls[0][0].where).toEqual({ userId: USER.applicationUser.id });
  });
});

describe("account router — mentoring 경로", () => {
  it("mentoring/slots 와 mentoring/bookings 를 각 핸들러로 보낸다", async () => {
    const slots = vi.fn(async (_req, res) => res.status(200).json({ slots: [] }));
    const bookings = vi.fn(async (_req, res) => res.status(200).json({ bookings: [] }));
    const handler = createAccountRoutesHandler({ mentoringSlotsHandler: slots, mentoringBookingsHandler: bookings });

    await handler({ method: "GET", query: { route: ["mentoring", "slots"] } }, createResponse());
    await handler({ method: "GET", query: { route: ["mentoring", "bookings"] } }, createResponse());
    const unknown = createResponse();
    await handler({ method: "GET", query: { route: ["mentoring", "nope"] } }, unknown);

    expect(slots).toHaveBeenCalledTimes(1);
    expect(bookings).toHaveBeenCalledTimes(1);
    expect(unknown.statusCode).toBe(404);
  });
});
