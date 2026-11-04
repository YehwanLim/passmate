import { INTERVIEW_LIVE_COPY } from "@/copy/interviewCopy";

export type InterviewerActivity = "connecting" | "reconnecting" | "speaking" | "listening" | "thinking";

/**
 * 면접관 자리: 미리 만들어 둔 면접관 사진(가상의 인물)과 이름표.
 * 말할 때는 사진 둘레로 테가 번지고 이름 옆 파형이 움직인다. 듣거나 생각할 때는 상태 글 뒤에 점 세 개가 깜빡여
 * "지금 받아들이는 중"이 보이게 한다. 전부 CSS 애니메이션이라 오디오 분석이 필요 없다.
 */
export default function InterviewerPresence({ activity, status, photoSrc }: { activity: InterviewerActivity; status: string; photoSrc: string }) {
  const speaking = activity === "speaking";
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4 rounded-3xl bg-navy px-6 py-8 text-white" data-testid="interviewer-presence" data-activity={activity}>
      <div className="relative h-36 w-36">
        {speaking && <span className="interview-ring absolute inset-0 rounded-full border-2 border-white/70" aria-hidden="true" />}
        <img src={photoSrc} alt="" width={144} height={144} className="h-36 w-36 rounded-full object-cover ring-4 ring-white/15" />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-2">
          <p className="text-[17px] font-bold">{INTERVIEW_LIVE_COPY.interviewer}</p>
          {speaking && (
            <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
              {[0, 1, 2].map((bar) => (
                <span key={bar} className="interview-wave w-1 rounded-full bg-white/90" style={{ animationDelay: `${bar * 0.12}s`, maxHeight: 16 }} />
              ))}
            </span>
          )}
        </div>
        <p className="mt-1 text-[14px] text-white/70" aria-live="polite">
          {status}
          {!speaking && (
            <span className="ml-0.5 inline-flex" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="interview-dot" style={{ animationDelay: `${dot * 0.2}s` }}>·</span>
              ))}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
