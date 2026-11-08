import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

import { PRICING, formatKrw } from "@/lib/pricing";

/* ─────────────────────────────────────────────────────────
   InterviewPracticeIntroSection — 랜딩 AI 모의 면접 소개
   리포트 쇼케이스(예상 질문을 보여 줌) 바로 다음에 둔다. "읽어 본 질문을 말로 답해 본다"로 이어진다.
   오른쪽 그림은 실제 면접 화면(InterviewCall)의 캡처다. 면접관 사진만 실제 화면보다 크게 키웠고,
   지원자 카메라 자리에는 생성한 가상 인물 사진을 넣었다.
   ───────────────────────────────────────────────────────── */

export const INTERVIEW_PRACTICE_INTRO_ID = "interview-practice";

export default function InterviewPracticeIntroSection() {
  return (
    <section id={INTERVIEW_PRACTICE_INTRO_ID} className="scroll-mt-24 bg-fill-soft py-20 md:py-[120px]">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-stretch">
          <div className="flex flex-col justify-center rounded-[28px] bg-surface p-6 md:rounded-[32px] md:p-[52px]">
            <span className="inline-flex h-7 w-fit items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">AI 모의 면접</span>
            <h2 className="mt-[18px] text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink text-balance md:text-[44px]">
              예상 질문은 읽어 봤는데
              <br />
              <span className="text-brand">말로</span> 답해 본 적 있나요?
            </h2>
            <p className="mt-[18px] max-w-lg text-pretty text-[16px] leading-[1.75] text-ink-3 md:text-[17px]">
              카메라와 마이크를 켜고 내 자소서를 읽은 AI 면접관과 화상 면접처럼 이야기해요. 대답하면 그 말을 듣고 다시 묻고, 면접이 끝나면 괜찮았던 답과 고치면 좋을 답을 나눠서 알려 줘요. 시선이나 자세가 어땠는지도 짚어 줘요.
            </p>
            <div className="mt-[26px] flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              <Link href="/analyze" className="landing-primary-cta group w-full whitespace-nowrap sm:w-auto" data-funnel-cta="interview-intro">
                <span className="relative z-10">무료 리포트부터 받기</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/entitlements#interview" className="landing-secondary-cta w-full whitespace-nowrap sm:w-auto" data-funnel-cta="interview-intro-pass">
                면접 이용권 보기
              </Link>
            </div>
            <p className="mt-5 text-[13px] leading-[1.6] text-ink-4">
              면접은 1회 {formatKrw(PRICING.interview.salePrice)}이고 15분 실전과 5분 짧은 연습 중에 고를 수 있어요. 자소서 리포트를 받은 뒤에 시작하는데, 첫 리포트는 무료예요.
              <br />
              이미 리포트가 있다면 <Link href="/my" className="font-semibold text-ink-3 underline underline-offset-2">내 리포트</Link>에서 바로 시작하세요. 목소리와 영상은 저장하지 않아요.
            </p>
          </div>

          {/* 그림 비율 그대로 둔다. 칸에 맞춰 늘리면 양옆의 시간 표시와 지원자 창이 잘린다. */}
          <div className="overflow-hidden rounded-[28px] bg-[#0b1020] md:self-center md:rounded-[32px]">
            <img
              src="/interview/call-preview.jpg"
              alt="AI 면접관이 질문하는 면접 화면. 면접관 사진과 자막, 오른쪽 아래 지원자 카메라 창, 면접 끝내기 버튼이 보인다."
              width={1280}
              height={1062}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
