import { INTERVIEW_LIVE_COPY } from "@/copy/interviewCopy";

/**
 * 면접관 자리: 이름표와 말할 때 움직이는 파형. 아바타·영상은 쓰지 않는다.
 * 파형은 CSS 애니메이션으로만 움직여 오디오 분석 없이도 "지금 말하는 중"이 읽힌다.
 */
export default function InterviewerPresence({ speaking, status }: { speaking: boolean; status: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-5 rounded-3xl bg-navy px-6 py-8 text-white">
      <div className="flex h-12 items-end gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((bar) => (
          <span
            key={bar}
            className={`w-2 rounded-full bg-white/90 transition-all ${speaking ? "interview-wave" : "h-2 opacity-50"}`}
            style={speaking ? { animationDelay: `${bar * 0.12}s` } : undefined}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="text-[17px] font-bold">{INTERVIEW_LIVE_COPY.interviewer}</p>
        <p className="mt-1 text-[14px] text-white/70" aria-live="polite">{status}</p>
      </div>
    </div>
  );
}
