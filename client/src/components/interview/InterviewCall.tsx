import { CameraOff } from "lucide-react";
import type { RefObject } from "react";

import { INTERVIEW_LIVE_COPY, INTERVIEWER_STATUS_COPY } from "@/copy/interviewCopy";

export type InterviewerActivity = "connecting" | "reconnecting" | "speaking" | "listening" | "thinking";

export type CallSubtitle = { speaker: "CANDIDATE" | "INTERVIEWER"; text: string; draft: boolean } | null;

type Props = {
  activity: InterviewerActivity;
  photoSrc: string;
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraOn: boolean;
  micLevel: number;
  candidateSpeaking: boolean;
  elapsedMs: number;
  totalMinutes: number;
  reconnects: number;
  ending: boolean;
  onEnd: () => void;
  subtitle: CallSubtitle;
};

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * 면접 중 화면: 화상통화처럼 화면 전체를 쓴다. 면접관 사진(생성된 가상의 인물)이 가운데 크게, 내 카메라는 오른쪽 아래 작은 창.
 * 사진은 숨 쉬듯 천천히 움직이고 말할 때는 조금 당겨지며 둘레로 테가 번진다. 듣거나 생각할 때는 상태 글 뒤 점 세 개가 깜빡인다.
 * 전부 CSS 애니메이션이라 오디오 분석이 필요 없다.
 */
export default function InterviewCall({ activity, photoSrc, videoRef, cameraOn, micLevel, candidateSpeaking, elapsedMs, totalMinutes, reconnects, ending, onEnd, subtitle }: Props) {
  const speaking = activity === "speaking";
  const levelPercent = Math.max(4, Math.min(100, micLevel * 600));
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#0b1020] text-white" data-testid="interview-call" data-activity={activity}>
      {/* 배경: 같은 사진을 흐리게 깔아 화면을 채운다 */}
      <img src={photoSrc} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-3xl" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" aria-hidden="true" />

      {/* 면접관 */}
      <div className="absolute inset-x-0 top-20 bottom-32 flex flex-col items-center justify-center gap-5 px-6 md:top-0 md:bottom-28">
        <div className="relative w-[min(68vw,320px)] md:w-[min(40vh,380px)]">
          {speaking && <span className="interview-ring absolute -inset-2 rounded-[32px] border-2 border-white/60" aria-hidden="true" />}
          <div className="relative aspect-square overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/15">
            <img src={photoSrc} alt="" className={`interview-portrait h-full w-full object-cover${speaking ? " interview-portrait--speaking" : ""}`} />
          </div>
          <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold">{INTERVIEW_LIVE_COPY.interviewer}</span>
        </div>
        <p className="flex items-center gap-2 text-[15px] text-white/80" aria-live="polite">
          {INTERVIEWER_STATUS_COPY[activity]}
          {speaking ? (
            <span className="flex h-4 items-end gap-0.5" aria-hidden="true">
              {[0, 1, 2].map((bar) => (
                <span key={bar} className="interview-wave w-1 rounded-full bg-white/90" style={{ animationDelay: `${bar * 0.12}s`, maxHeight: 16 }} />
              ))}
            </span>
          ) : (
            <span className="-ml-1 inline-flex" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span key={dot} className="interview-dot" style={{ animationDelay: `${dot * 0.2}s` }}>·</span>
              ))}
            </span>
          )}
        </p>
      </div>

      {/* 시간 */}
      <p className="absolute left-5 top-5 rounded-full bg-black/45 px-3.5 py-1.5 text-[14px] tabular-nums text-white/90" aria-live="off">
        {formatClock(elapsedMs)} / {totalMinutes}:00
        {reconnects > 0 && <span className="ml-2 text-[12px] text-white/60">재연결 {reconnects}회</span>}
      </p>

      {/* 내 카메라 */}
      {/* 폰에서는 오른쪽 위(시간 옆), 넓은 화면에서는 오른쪽 아래 */}
      <div className="absolute right-4 top-4 aspect-video w-32 overflow-hidden rounded-2xl bg-black/70 ring-1 ring-white/20 md:bottom-7 md:right-7 md:top-auto md:w-60">
        <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`} />
        {!cameraOn && <div className="flex h-full items-center justify-center text-white/60"><CameraOff className="h-6 w-6" aria-hidden="true" /></div>}
        <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold">{INTERVIEW_LIVE_COPY.you}</span>
        {/* 내 목소리 크기. 말하는 동안 막대가 움직여 "들어가고 있다"가 보인다. */}
        <span
          className="absolute bottom-2 right-2 flex h-5 w-12 items-center rounded-full bg-black/55 px-2 md:w-24"
          role="meter"
          aria-label="내 목소리 크기"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(1, micLevel * 6) * 100)}
        >
          <span className={`h-1 rounded-full transition-[width] duration-100 ${candidateSpeaking ? "bg-white" : "bg-white/50"}`} style={{ width: `${levelPercent}%` }} />
        </span>
      </div>

      {/* 자막과 끝내기 */}
      <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-5 md:bottom-7 md:pr-72">
        {subtitle && subtitle.text && (
          <p className={`max-w-xl rounded-2xl bg-black/50 px-4 py-2 text-center text-[14px] leading-relaxed ${subtitle.draft ? "text-white/70" : "text-white/90"}`} aria-live="polite">
            {/* 줄 제한은 안쪽 span 에: p 에 걸면 padding 자리에 세 번째 줄이 비친다 */}
            <span className="line-clamp-2">
              <span className="mr-1.5 font-semibold">{subtitle.speaker === "CANDIDATE" ? INTERVIEW_LIVE_COPY.you : INTERVIEW_LIVE_COPY.interviewer}</span>
              {subtitle.text}
            </span>
          </p>
        )}
        <button
          type="button"
          onClick={onEnd}
          disabled={ending}
          className="inline-flex h-12 items-center rounded-full bg-[#e5484d] px-6 text-[15px] font-bold text-white shadow-lg transition-colors hover:bg-[#d13c41] disabled:opacity-60"
        >
          {ending ? "정리 중" : INTERVIEW_LIVE_COPY.end}
        </button>
      </div>
    </div>
  );
}
