import { getAuthorizationHeader } from "@/lib/apiAuth";

/**
 * 커피챗·모의면접 예약 API 클라이언트. 서버는 lib/mentoring.js (계정 라우터 `/api/account/mentoring/*`).
 * 슬롯 목록은 로그인 없이 읽고, 신청은 로그인 토큰이 필요하다.
 */
export const MENTORING_SESSION_TYPES = ["RESUME_REVIEW", "COFFEE_CHAT", "MOCK_INTERVIEW"] as const;
export type MentoringSessionType = (typeof MENTORING_SESSION_TYPES)[number];
export type MentoringBookingStatus = "REQUESTED" | "CONFIRMED" | "CANCELLED";

export type MentoringSlot = { id: string; startsAt: string; durationMin: number };
export type MentoringBooking = {
  id: string;
  status: MentoringBookingStatus;
  sessionType: MentoringSessionType;
  message: string;
  createdAt: string;
  slot: MentoringSlot;
};

export const BOOKING_MESSAGE_MIN = 10;
export const BOOKING_MESSAGE_MAX = 1000;

export class MentoringApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "MentoringApiError";
    this.code = code;
    this.status = status;
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return null;
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const headers: Record<string, string> = { ...(init.body ? { "Content-Type": "application/json" } : {}) };
  if (authenticated) Object.assign(headers, await getAuthorizationHeader());
  const response = await fetch(path, { ...init, headers });
  const payload = await readJson(response);
  if (!response.ok) {
    const code = typeof payload?.error === "string" ? payload.error : "REQUEST_FAILED";
    throw new MentoringApiError(code, response.status);
  }
  return payload as T;
}

export async function fetchOpenSlots(): Promise<MentoringSlot[]> {
  const payload = await request<{ slots?: MentoringSlot[] }>("/api/account/mentoring/slots");
  return Array.isArray(payload.slots) ? payload.slots : [];
}

export async function fetchMyBookings(): Promise<MentoringBooking[]> {
  const payload = await request<{ bookings?: MentoringBooking[] }>("/api/account/mentoring/bookings", {}, true);
  return Array.isArray(payload.bookings) ? payload.bookings : [];
}

export async function createBooking(input: {
  slotId: string;
  sessionType: MentoringSessionType;
  message: string;
}): Promise<MentoringBooking> {
  const payload = await request<{ booking: MentoringBooking }>(
    "/api/account/mentoring/bookings",
    { method: "POST", body: JSON.stringify(input) },
    true,
  );
  return payload.booking;
}

const KST = "Asia/Seoul";

/** "9월 27일 (토)" — 슬롯을 날짜별로 묶는 라벨. 사용자·관리자가 한국에 있으므로 KST 로 고정한다. */
export function slotDayLabel(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, month: "long", day: "numeric", weekday: "short" }).format(new Date(iso));
}

/** "오후 8:00" */
export function slotTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

/** 날짜 라벨별 슬롯 묶음. 입력 순서(시간순)를 유지한다. */
export function groupSlotsByDay(slots: readonly MentoringSlot[]): Array<{ day: string; slots: MentoringSlot[] }> {
  const groups: Array<{ day: string; slots: MentoringSlot[] }> = [];
  for (const slot of slots) {
    const day = slotDayLabel(slot.startsAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.slots.push(slot);
    else groups.push({ day, slots: [slot] });
  }
  return groups;
}

export const BOOKING_ERROR_MESSAGES: Record<string, string> = {
  SLOT_UNAVAILABLE: "방금 다른 분이 이 시간을 잡았어요. 다른 시간을 골라 주세요.",
  BOOKING_LIMIT_REACHED: "진행 중인 신청이 이미 2건이에요. 세션이 끝난 뒤 다시 신청해 주세요.",
  INVALID_REQUEST: "입력을 다시 확인해 주세요. 상황 설명은 10자 이상이어야 해요.",
  AUTHENTICATION_REQUIRED: "로그인이 필요해요.",
};

export function bookingErrorMessage(error: unknown): string {
  if (error instanceof MentoringApiError) return BOOKING_ERROR_MESSAGES[error.code] ?? "신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
  return "신청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
}
