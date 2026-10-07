import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import AnalyzeLoginModal from "@/components/analyze/AnalyzeLoginModal";
import { useAuth } from "@/contexts/AuthContext";
import {
  MENTORING_CONTACT_EMAIL,
  MENTORING_SESSIONS,
  MOCK_INTERVIEW_PAYMENT_URL,
  SESSION_LABELS,
} from "@/constants/mentoring";
import {
  BOOKING_MESSAGE_MAX,
  BOOKING_MESSAGE_MIN,
  bookingErrorMessage,
  createBooking,
  fetchMyBookings,
  fetchOpenSlots,
  groupSlotsByDay,
  slotDayLabel,
  slotTimeLabel,
  type MentoringBooking,
  type MentoringSessionType,
  type MentoringSlot,
} from "@/lib/mentoring";

export const BOOKING_SECTION_ID = "book";

const STATUS_LABELS: Record<MentoringBooking["status"], string> = {
  REQUESTED: "확인 중",
  CONFIRMED: "확정",
  CANCELLED: "취소됨",
};

const MESSAGE_PLACEHOLDER =
  "예) 서비스 기획 직무로 하반기 공채 준비 중인데 서류에서 세 번 떨어졌습니다. 경험은 있는데 직무와 연결이 안 되는 것 같아요. 전공/경력, 목표 기업·직무, 지금 가장 큰 고민 정도를 적어주시면 됩니다.";

/**
 * 열린 시간 → 세션 종류·상황 → 신청. 로그인은 보내는 순간에만 받는다(분석 폼과 같은 방식).
 * 슬롯 목록은 로그인 없이 보이므로, 블로그에서 온 사람이 시간을 먼저 보고 결정할 수 있다.
 */
export default function BookingSection({ preselectedType }: { preselectedType: MentoringSessionType | null }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [slots, setSlots] = useState<MentoringSlot[] | null>(null);
  const [slotsError, setSlotsError] = useState(false);
  const [myBookings, setMyBookings] = useState<MentoringBooking[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<MentoringSlot | null>(null);
  const [sessionType, setSessionType] = useState<MentoringSessionType>(preselectedType ?? "COFFEE_CHAT");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<MentoringBooking | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    if (preselectedType) setSessionType(preselectedType);
  }, [preselectedType]);

  const loadSlots = useCallback(async () => {
    try {
      setSlots(await fetchOpenSlots());
      setSlotsError(false);
    } catch {
      setSlots([]);
      setSlotsError(true);
    }
  }, []);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMyBookings([]);
      return;
    }
    setLoginOpen(false);
    fetchMyBookings().then(setMyBookings).catch(() => setMyBookings([]));
  }, [isAuthenticated]);

  const trimmedLength = message.trim().length;
  const canSubmit = selectedSlot !== null && trimmedLength >= BOOKING_MESSAGE_MIN && trimmedLength <= BOOKING_MESSAGE_MAX && !submitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedSlot) return;
    if (!isAuthenticated) {
      setLoginOpen(true);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await createBooking({ slotId: selectedSlot.id, sessionType, message: message.trim() });
      setDone(booking);
      setMyBookings(previous => [booking, ...previous]);
      setSelectedSlot(null);
      setMessage("");
      void loadSlots();
    } catch (error) {
      setSubmitError(bookingErrorMessage(error));
      void loadSlots();
    } finally {
      setSubmitting(false);
    }
  };

  const groups = groupSlotsByDay(slots ?? []);
  const activeBookings = myBookings.filter(booking => booking.status !== "CANCELLED");

  return (
    <section id={BOOKING_SECTION_ID} className="scroll-mt-20 py-16 md:py-24">
      <div className="mx-auto w-full max-w-4xl px-6 lg:px-10">
        <h2 className="mb-3 text-[28px] font-extrabold leading-[1.25] tracking-[-0.035em] text-ink md:text-[36px]">시간 고르기</h2>
        <p className="mb-10 max-w-xl text-[15px] leading-[1.8] text-ink-4 md:text-[16px]">
          제가 가능한 시간만 열어두었습니다. 하나 고르고, 어떤 세션인지와 지금 상황을 적어주세요.
          퇴근 후와 주말 시간이 많습니다.
        </p>

        {activeBookings.length > 0 && (
          <div className="mb-6 rounded-[20px] bg-ok-soft p-5">
            <p className="mb-3 text-[14px] font-bold text-ok">내 신청</p>
            <ul className="space-y-2">
              {activeBookings.map(booking => (
                <li key={booking.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[14px] text-ink-2">
                  <span>
                    {slotDayLabel(booking.slot.startsAt)} {slotTimeLabel(booking.slot.startsAt)} · {SESSION_LABELS[booking.sessionType]}
                  </span>
                  <span className="text-[13px] font-semibold text-ink-3">{STATUS_LABELS[booking.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {done && (
          <div className="mb-6 rounded-[20px] bg-surface p-6">
            <p className="mb-2 flex items-center gap-2 text-[16px] font-bold text-ink">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-ok" />
              신청을 받았어요
            </p>
            <p className="text-[14.5px] leading-[1.8] text-ink-3">
              {slotDayLabel(done.slot.startsAt)} {slotTimeLabel(done.slot.startsAt)} · {SESSION_LABELS[done.sessionType]}.
              이틀 안에 가입하신 메일로 답장 드립니다. 결제 안내와 Zoom/Google Meet 링크가 함께 갑니다.
            </p>
            {done.sessionType === "MOCK_INTERVIEW" && (
              <p className="mt-3 text-[14px] leading-[1.8] text-ink-4">
                결제가 확인되면 확정됩니다.{" "}
                {MOCK_INTERVIEW_PAYMENT_URL ? (
                  <a href={MOCK_INTERVIEW_PAYMENT_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-ink underline underline-offset-2 hover:text-brand">
                    지금 결제하기 <ArrowRight aria-hidden="true" className="h-3 w-3" />
                  </a>
                ) : (
                  "결제 방법은 답장에 함께 안내드립니다."
                )}
              </p>
            )}
          </div>
        )}

        {slots === null ? (
          <p className="py-10 text-center text-[14px] text-ink-4">열린 시간을 불러오는 중…</p>
        ) : slots.length === 0 ? (
          <div className="rounded-[24px] bg-surface p-8 text-center">
            <p className="text-[15px] font-semibold text-ink-2">
              {slotsError ? "시간을 불러오지 못했습니다. 잠시 후 다시 열어주세요." : "지금은 열린 시간이 없습니다."}
            </p>
            <p className="mt-2 text-[14px] leading-[1.8] text-ink-4">
              보통 주말에 다음 주 시간을 엽니다. 급하시면{" "}
              <a href={`mailto:${MENTORING_CONTACT_EMAIL}`} className="font-semibold text-brand-ink underline underline-offset-2 hover:text-brand">
                메일
              </a>
              로 상황을 보내주시면 따로 시간을 잡아보겠습니다.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8 rounded-[28px] bg-surface p-6 md:p-8">
            <fieldset>
              <legend className="mb-4 text-[16px] font-bold text-ink">1. 시간</legend>
              <div className="space-y-5">
                {groups.map(group => (
                  <div key={group.day}>
                    <p className="mb-2 text-[14px] font-semibold text-ink-3">{group.day}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.slots.map(slot => {
                        const selected = selectedSlot?.id === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setSelectedSlot(slot)}
                            className={
                              selected
                                ? "rounded-[12px] border border-brand bg-brand-soft px-4 py-2.5 text-[14px] font-semibold text-brand-ink"
                                : "rounded-[12px] border border-line bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink-2 transition-colors hover:border-ink-5"
                            }
                          >
                            {slotTimeLabel(slot.startsAt)}
                            <span className={selected ? "ml-1.5 text-[12px] font-medium text-brand-ink" : "ml-1.5 text-[12px] font-medium text-ink-4"}>{slot.durationMin}분</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-4 text-[16px] font-bold text-ink">2. 세션</legend>
              <div className="flex flex-wrap gap-2">
                {MENTORING_SESSIONS.map(session => {
                  const selected = sessionType === session.type;
                  return (
                    <button
                      key={session.type}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSessionType(session.type)}
                      className={
                        selected
                          ? "rounded-[12px] border border-brand bg-brand-soft px-4 py-2.5 text-[14px] font-semibold text-brand-ink"
                          : "rounded-[12px] border border-line bg-surface px-4 py-2.5 text-[14px] font-semibold text-ink-2 transition-colors hover:border-ink-5"
                      }
                    >
                      {session.name} · {session.priceShort}
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[13.5px] leading-[1.7] text-ink-4">
                결제 안내는 답장에 함께 드리고, 결제가 확인되면 확정됩니다. 자소서 첨삭은 문항 수를 아래에 적어주세요.
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-4 text-[16px] font-bold text-ink">3. 지금 상황 (자세할수록 좋아요)</legend>
              <label htmlFor="booking-message" className="sr-only">지금 상황과 궁금한 점</label>
              <textarea
                id="booking-message"
                value={message}
                onChange={event => setMessage(event.target.value)}
                maxLength={BOOKING_MESSAGE_MAX}
                rows={5}
                placeholder={MESSAGE_PLACEHOLDER}
                className="w-full rounded-[12px] border border-line bg-surface px-4 py-3 text-[15px] leading-[1.8] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
              />
              <p className="mt-2 text-right text-[12.5px] text-ink-4">
                {trimmedLength} / {BOOKING_MESSAGE_MAX}자 · 최소 {BOOKING_MESSAGE_MIN}자. 자소서 본문은 여기 말고, 답장을 받으신 뒤 메일로 보내주세요.
              </p>
            </fieldset>

            {submitError && (
              <p role="alert" className="rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] text-danger">{submitError}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={!canSubmit || authLoading}
                className="group inline-flex h-[52px] items-center gap-2 rounded-[12px] bg-brand px-6 text-[15px] font-bold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand"
              >
                <span>{submitting ? "보내는 중" : "이 시간으로 신청하기"}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
              <p className="mt-3 text-[13px] text-ink-4">
                {isAuthenticated ? "가입하신 메일로 답장 드립니다." : "보낼 때 로그인합니다. 고른 시간과 적은 내용은 그대로 남습니다."}
              </p>
            </div>
          </form>
        )}
      </div>

      <AnalyzeLoginModal
        open={loginOpen && !isAuthenticated}
        onClose={() => setLoginOpen(false)}
        redirectPath="/mentoring"
        description="고른 시간과 적은 내용은 그대로 남아 있습니다. 로그인한 뒤 신청하기를 한 번 더 눌러주세요. 답장은 가입하신 메일로 갑니다."
      />
    </section>
  );
}
