import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    mentoringSlot: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    mentoringBooking: { update: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (writes) => Promise.all(writes)),
  },
  requireAdministrator: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({ requireAdministrator: mocks.requireAdministrator }));
vi.mock("../../../lib/prisma.js", () => ({ default: mocks.prisma }));

const { mentoringHandler, mentoringDetailHandler, readSlotBody } = await import("../../../lib/admin-handlers/mentoring.js");
import { createResponse } from "../../helpers/http.js";

const SLOT_ID = "33333333-3333-4333-8333-333333333333";
const FUTURE = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
const BOOKING = {
  id: "b1", status: "REQUESTED", sessionType: "MOCK_INTERVIEW", message: "면접 3일 전입니다", createdAt: new Date(),
  user: { email: "u@example.com", name: "지원자" },
};
const openSlot = () => ({ id: SLOT_ID, startsAt: FUTURE, durationMin: 60, status: "OPEN", createdAt: new Date(), bookings: [] });
const bookedSlot = () => ({ ...openSlot(), status: "BOOKED", bookings: [BOOKING] });

describe("admin mentoring — 슬롯·신청 관리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdministrator.mockResolvedValue({ applicationUser: { id: "admin", role: "admin" } });
  });

  it("비관리자는 403 이고 아무것도 읽지 않는다", async () => {
    mocks.requireAdministrator.mockRejectedValue(Object.assign(new Error("forbidden"), { statusCode: 403, code: "FORBIDDEN" }));
    const res = createResponse();
    await mentoringHandler({ method: "GET", query: {} }, res);
    expect(res.statusCode).toBe(403);
    expect(mocks.prisma.mentoringSlot.findMany).not.toHaveBeenCalled();
  });

  it("GET 은 슬롯과 붙어 있는 신청자를 함께 준다(이메일 포함, 자소서 본문 없음)", async () => {
    mocks.prisma.mentoringSlot.findMany.mockResolvedValue([bookedSlot()]);
    const res = createResponse();
    await mentoringHandler({ method: "GET", query: {} }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.slots[0]).toEqual(expect.objectContaining({
      id: SLOT_ID, status: "BOOKED",
      booking: expect.objectContaining({ userEmail: "u@example.com", sessionType: "MOCK_INTERVIEW" }),
    }));
  });

  it("POST 는 미래 시각·허용 길이만 받아 슬롯을 연다", async () => {
    mocks.prisma.mentoringSlot.create.mockResolvedValue(openSlot());
    const res = createResponse();
    await mentoringHandler({ method: "POST", query: {}, body: { startsAt: FUTURE.toISOString(), durationMin: 60 } }, res);
    expect(res.statusCode).toBe(201);
    expect(mocks.prisma.mentoringSlot.create.mock.calls[0][0].data).toEqual({ startsAt: FUTURE, durationMin: 60 });

    const bad = createResponse();
    await mentoringHandler({ method: "POST", query: {}, body: { startsAt: "2020-01-01T00:00:00Z", durationMin: 60 } }, bad);
    expect(bad.statusCode).toBe(400);
    expect(readSlotBody({ startsAt: FUTURE.toISOString(), durationMin: 45 })).toBeNull();
  });

  it("confirm 은 신청을 CONFIRMED 로, cancel 은 CANCELLED + 슬롯 OPEN 으로 바꾼다", async () => {
    mocks.prisma.mentoringSlot.findUnique.mockResolvedValueOnce(bookedSlot()).mockResolvedValueOnce({ ...bookedSlot(), bookings: [{ ...BOOKING, status: "CONFIRMED" }] });
    const res = createResponse();
    await mentoringDetailHandler({ method: "PATCH", query: { id: SLOT_ID }, body: { action: "confirm" } }, res);
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.mentoringBooking.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { status: "CONFIRMED" } });
    expect(mocks.prisma.mentoringSlot.update).toHaveBeenCalledWith({ where: { id: SLOT_ID }, data: { status: "BOOKED" } });

    vi.clearAllMocks();
    mocks.prisma.mentoringSlot.findUnique.mockResolvedValueOnce(bookedSlot()).mockResolvedValueOnce(openSlot());
    const cancel = createResponse();
    await mentoringDetailHandler({ method: "PATCH", query: { id: SLOT_ID }, body: { action: "cancel" } }, cancel);
    expect(mocks.prisma.mentoringBooking.update).toHaveBeenCalledWith({ where: { id: "b1" }, data: { status: "CANCELLED" } });
    expect(mocks.prisma.mentoringSlot.update).toHaveBeenCalledWith({ where: { id: SLOT_ID }, data: { status: "OPEN" } });
  });

  it("신청이 붙은 슬롯은 close·삭제가 409, 신청 없는 슬롯에 confirm 도 409", async () => {
    mocks.prisma.mentoringSlot.findUnique.mockResolvedValue(bookedSlot());
    const close = createResponse();
    await mentoringDetailHandler({ method: "PATCH", query: { id: SLOT_ID }, body: { action: "close" } }, close);
    expect(close.statusCode).toBe(409);
    const del = createResponse();
    await mentoringDetailHandler({ method: "DELETE", query: { id: SLOT_ID } }, del);
    expect(del.statusCode).toBe(409);
    expect(mocks.prisma.mentoringSlot.delete).not.toHaveBeenCalled();

    mocks.prisma.mentoringSlot.findUnique.mockResolvedValue(openSlot());
    const confirm = createResponse();
    await mentoringDetailHandler({ method: "PATCH", query: { id: SLOT_ID }, body: { action: "confirm" } }, confirm);
    expect(confirm.statusCode).toBe(409);
  });

  it("신청 없는 슬롯은 삭제되고, 없는 ID 는 404", async () => {
    mocks.prisma.mentoringSlot.findUnique.mockResolvedValueOnce(openSlot());
    const res = createResponse();
    await mentoringDetailHandler({ method: "DELETE", query: { id: SLOT_ID } }, res);
    expect(res.statusCode).toBe(200);
    expect(mocks.prisma.mentoringSlot.delete).toHaveBeenCalledWith({ where: { id: SLOT_ID } });

    mocks.prisma.mentoringSlot.findUnique.mockResolvedValueOnce(null);
    const missing = createResponse();
    await mentoringDetailHandler({ method: "DELETE", query: { id: "nope" } }, missing);
    expect(missing.statusCode).toBe(404);
  });
});
