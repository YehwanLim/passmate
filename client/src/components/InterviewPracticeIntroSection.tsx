import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

import { PRICING, formatKrw } from "@/lib/pricing";

/* ─────────────────────────────────────────────────────────
   InterviewPracticeIntroSection — 랜딩 AI 모의 면접 소개
   리포트 쇼케이스(예상 질문을 보여 줌) 바로 다음에 둔다. "읽어 본 질문을 말로 답해 본다"로 이어진다.
   오른쪽 그림은 실제 면접 화면(InterviewCall)의 캡처다. 면접관 사진만 실제 화면보다 크게 키웠고,
   지원자 카메라 자리에는 생성한 가상 인물 사진을 넣었다.
   variant="page" 는 /my/interview-practice 소개 화면 맨 위에 같은 칸을 쓴다(11-09). 버튼이 아래 입력 칸으로 내려간다.
   11-09 리포트 없이도 면접을 시작할 수 있게 되어 "무료 리포트부터 받기"를 "면접 보러 가기"로 바꿨다.
   ───────────────────────────────────────────────────────── */

export const INTERVIEW_PRACTICE_INTRO_ID = "interview-practice";
/** 소개 화면(variant="page")에서 "면접 시작하기"가 내려가는 입력 칸 id. */
export const INTERVIEW_START_FORM_ID = "interview-start";

export default function InterviewPracticeIntroSection({ variant = "landing" }: { variant?: "landing" | "page" }) {
  const isPage = variant === "page";
  const Heading = isPage ? "h1" : "h2";
  return (
    <section id={isPage ? undefined : INTERVIEW_PRACTICE_INTRO_ID} className={`scroll-mt-24 bg-fill-soft ${isPage ? "py-10 md:py-16" : "py-20 md:py-[120px]"}`}>
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-stretch">
          <div className="flex flex-col justify-center rounded-[28px] bg-surface p-6 md:rounded-[32px] md:p-[52px]">
            <span className="inline-flex h-7 w-fit items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">AI 모의 면접</span>
            <Heading className="mt-[18px] text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink text-balance md:text-[44px]">
              머릿속에만 있는 답변,
              <br />
              <span className="text-brand">소리 내서</span> 답해보셨나요?
            </Heading>
            <p className="mt-[18px] max-w-lg text-pretty text-[16px] leading-[1.75] text-ink-3 md:text-[17px]">
              면접관은 자소서 한 줄에서 질문을 시작합니다. AI 면접관이 내 자소서를 읽고 묻고, 꼬리 질문까지 날카롭게 파고들어요. 끝나면 전체 면접에 대한 피드백과 고칠 점을 알려드려요.
            </p>
            <div className="mt-[26px] flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
              {isPage ? (
                // 같은 화면 안 칸으로 내려가므로 일반 <a> 다(wouter Link 는 해시만 바꾸고 스크롤하지 않는다).
                <a href={`#${INTERVIEW_START_FORM_ID}`} className="landing-primary-cta group w-full whitespace-nowrap sm:w-auto" data-funnel-cta="interview-page-start">
                  <span className="relative z-10">면접 시작하기</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              ) : (
                <Link href="/my/interview-practice" className="landing-primary-cta group w-full whitespace-nowrap sm:w-auto" data-funnel-cta="interview-intro">
                  <span className="relative z-10">면접 보러 가기</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link href="/entitlements#interview" className="landing-secondary-cta w-full whitespace-nowrap sm:w-auto" data-funnel-cta="interview-intro-pass">
                면접 이용권 보기
              </Link>
            </div>
            <p className="mt-5 text-[13px] leading-[1.6] text-ink-4">
              면접은 1회 {formatKrw(PRICING.interview.salePrice)}이고 15분 실전과 5분 짧은 연습 중에 고를 수 있어요. 리포트가 없어도 회사·직무와 자소서만 붙여 넣으면 바로 시작해요.
              <br />
              자소서 리포트가 있다면 <Link href="/my" className="font-semibold text-ink-3 underline underline-offset-2">내 리포트</Link>의 예상 질문으로도 시작할 수 있어요. 목소리와 영상은 저장하지 않아요.
            </p>
          </div>

          {/* 그림 비율 그대로 둔다. 칸에 맞춰 늘리면 양옆의 시간 표시와 지원자 창이 잘린다. */}
          <div className="overflow-hidden rounded-[28px] bg-[#0b1020] md:self-center md:rounded-[32px]">
            <img
              src="/interview/call-preview.jpg"
              alt="AI 면접관이 질문하는 면접 화면. 면접관 사진과 자막, 오른쪽 아래 지원자 카메라 창, 면접 끝내기 버튼이 보인다."
              width={1280}
              height={1062}
              loading={isPage ? "eager" : "lazy"}
              decoding="async"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
