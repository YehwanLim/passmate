import { INTERVIEW_LIVE_COPY } from "@/copy/interviewCopy";

/**
 * 면접관 자리: 코드로 그린 면접관 얼굴과 이름표. 영상·외부 그림 파일은 쓰지 않는다.
 * 말할 때는 입이 움직이고 얼굴 둘레로 테가 번지며, 이름 옆 작은 파형이 함께 움직인다. 전부 CSS 애니메이션이라 오디오 분석이 필요 없다.
 */
export default function InterviewerPresence({ speaking, status }: { speaking: boolean; status: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4 rounded-3xl bg-navy px-6 py-8 text-white">
      <InterviewerAvatar speaking={speaking} />
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
        <p className="mt-1 text-[14px] text-white/70" aria-live="polite">{status}</p>
      </div>
    </div>
  );
}

function InterviewerAvatar({ speaking }: { speaking: boolean }) {
  return (
    <svg viewBox="0 0 120 120" width="148" height="148" aria-hidden="true" data-testid="interviewer-avatar" data-speaking={speaking ? "true" : "false"}>
      <defs>
        <clipPath id="interviewer-avatar-disc">
          <circle cx="60" cy="60" r="56" />
        </clipPath>
      </defs>
      {speaking && <circle className="interview-ring" cx="60" cy="60" r="57" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />}
      <circle cx="60" cy="60" r="56" fill="#E6EDF8" />
      <g clipPath="url(#interviewer-avatar-disc)">
        {/* 재킷·셔츠·넥타이 */}
        <path d="M18 122 C18 96 36 86 60 86 C84 86 102 96 102 122 Z" fill="#1E2A45" />
        <path d="M49 86 L60 104 L71 86 Z" fill="#FFFFFF" />
        <path d="M57 88 L60 100 L63 88 Z" fill="var(--color-brand, #3B6BE0)" />
        {/* 목·얼굴·머리 */}
        <rect x="52" y="72" width="16" height="18" rx="6" fill="#EFC2A0" />
        <circle cx="60" cy="54" r="24" fill="#F6D3B5" />
        <path d="M36 54 C36 37 46 28 60 28 C74 28 84 37 84 54 C80 45 72 41 60 41 C48 41 40 45 36 54 Z" fill="#2B2B36" />
        {/* 눈썹·눈 */}
        <path d="M46 49 Q51 46 56 49" stroke="#2B2B36" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <path d="M64 49 Q69 46 74 49" stroke="#2B2B36" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="51" cy="56" r="2.3" fill="#2B2B36" />
        <circle cx="69" cy="56" r="2.3" fill="#2B2B36" />
        {/* 입: 말할 때 세로로 열리고 닫힌다 */}
        <rect className={`interview-mouth${speaking ? " interview-mouth--speaking" : ""}`} x="54" y="64" width="12" height="7" rx="3.5" fill="#B5654F" />
      </g>
    </svg>
  );
}
