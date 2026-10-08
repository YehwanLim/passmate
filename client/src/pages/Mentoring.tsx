import { useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import { Link } from "wouter";

import { BrandName } from "@/components/BrandName";
import SiteHeader from "@/components/SiteHeader";
import BookingSection, { BOOKING_SECTION_ID } from "@/components/mentoring/BookingSection";
import {
  MENTORING_FOR,
  MENTORING_NOT_FOR,
  MENTORING_OPEN_CHAT_URL,
  MENTORING_REVIEWS,
  MENTORING_SESSIONS,
  MENTORING_STEPS,
} from "@/constants/mentoring";
import type { MentoringSessionType } from "@/lib/mentoring";

const REVIEW_PREVIEW_COUNT = 9;

/**
 * 커피챗·모의 면접·자소서 첨삭 — 사람이 직접 하는 세션의 소개와 예약.
 * 리포트(/)와는 다른 니즈("이 사람 이야기를 직접 듣고 싶다")라 페이지를 따로 두고, 서로 한 줄로만 잇는다.
 * 문체는 블로그 안내글(한시)의 것을 따른다 — 서비스 카피가 아니라 사람이 쓰는 글이라서. 예약은 BookingSection.
 */
export default function Mentoring() {
  const [preselectedType, setPreselectedType] = useState<MentoringSessionType | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const reviews = showAllReviews ? MENTORING_REVIEWS : MENTORING_REVIEWS.slice(0, REVIEW_PREVIEW_COUNT);

  return (
    <div className="min-h-screen bg-stage text-ink">
      <SiteHeader variant="light" />

      <main>
        {/* 소개 */}
        <section className="mx-auto w-full max-w-3xl px-6 pb-16 pt-20 sm:pt-28 lg:px-10">
          <p className="mb-4 text-[14px] font-semibold text-brand-ink">
            Mentoring
          </p>
          <h1 className="mb-8 text-[34px] font-extrabold leading-[1.2] tracking-[-0.035em] text-ink sm:text-[46px]">
            취업 멘토링,
            <br />
            직접 합니다.
          </h1>
          <div className="space-y-5 text-[16px] leading-[1.85] text-ink-3 md:text-[17px]">
            <p>
              꽤 힘들게 보냈던 취준 생활을 지나, 지금은 대기업에서 5년차 서비스 기획자로 일하고 있습니다.
              중간에 인사팀 채용파트에서 1년을 보내며 지원자와 채용자 양쪽 자리에 다 앉아봤어요.
            </p>
            <p>
              40개 가까운 기업에 지원하고 10번 넘게 면접을 보면서 알게 된 것들을, 그때 알았더라면 좋았을
              텐데 하는 마음으로 커피챗에서 나누기 시작했습니다. 그게 200번을 넘었고, 이제 이 페이지에서
              직접 받습니다.
            </p>
          </div>
          <div className="mt-10">
            <a
              href={`#${BOOKING_SECTION_ID}`}
              className="group inline-flex h-[52px] items-center gap-2 rounded-[12px] bg-brand px-6 text-[15px] font-bold text-white transition-colors hover:bg-brand-hover"
            >
              <span>열린 시간 보기</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
            <p className="mt-4 text-[13px] text-ink-4">
              Zoom / Google Meet 진행 · 신청 후 이틀 안에 답장
            </p>
          </div>
        </section>

        {/* 세션 메뉴 */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
            <h2 className="mb-3 text-[28px] font-extrabold leading-[1.25] tracking-[-0.035em] text-ink md:text-[36px]">멘토링 진행 방식</h2>
            <p className="mb-10 max-w-xl text-[15px] leading-[1.8] text-ink-4 md:text-[16px]">
              세 가지가 있습니다. 어느 쪽인지 모르겠으면 커피챗으로 시작하세요. 이야기하다 보면 무엇이 필요한지 나옵니다.
            </p>
            <div className="grid gap-5 md:grid-cols-3">
              {MENTORING_SESSIONS.map((session, index) => (
                <article
                  key={session.type}
                  className="flex h-full flex-col rounded-[24px] bg-surface p-7"
                >
                  <p className="mb-3 text-[13px] font-bold text-brand-ink">{String(index + 1).padStart(2, "0")}</p>
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h3 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{session.name}</h3>
                    <span className="inline-flex h-7 items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-semibold text-ink-3">{session.duration}</span>
                  </div>
                  <p className="text-[18px] font-bold tracking-[-0.02em] text-ink">{session.price}</p>
                  <p className="mt-5 text-[15px] leading-[1.8] text-ink-2">{session.summary}</p>
                  <p className="mt-3 text-[14px] leading-[1.8] text-ink-4">{session.detail}</p>
                  <div className="mt-auto pt-7">
                    <a
                      href={`#${BOOKING_SECTION_ID}`}
                      onClick={() => setPreselectedType(session.type)}
                      className="flex h-11 items-center justify-center gap-1.5 rounded-[12px] bg-fill px-4 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-line"
                    >
                      시간 고르기
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
            <p className="mt-6 text-[14px] leading-[1.8] text-ink-4">
              음성이 부담스럽거나 시간 맞추기 어려운 분은 텍스트 멘토링도 가능합니다.{" "}
              <a href={MENTORING_OPEN_CHAT_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink underline underline-offset-2 hover:text-brand">
                오픈카톡
              </a>
              으로 문의해 주세요.
            </p>
          </div>
        </section>

        {/* 예약 */}
        <BookingSection preselectedType={preselectedType} />

        {/* 추천 / 비추천 */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-4xl px-6 lg:px-10">
            <h2 className="mb-3 text-[28px] font-extrabold leading-[1.25] tracking-[-0.035em] text-ink md:text-[36px]">이런 분께 맞습니다</h2>
            <p className="mb-10 text-[15px] leading-[1.8] text-ink-4 md:text-[16px]">신청 전에 한 번 확인해 주세요.</p>
            <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
              <ul className="space-y-3 rounded-[24px] bg-surface p-7">
                {MENTORING_FOR.map(item => (
                  <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.75] text-ink-2">
                    <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-ok" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <ul className="space-y-3 rounded-[24px] bg-surface p-7">
                {MENTORING_NOT_FOR.map(item => (
                  <li key={item} className="flex items-start gap-3 text-[15px] leading-[1.75] text-ink-3">
                    <X aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-danger" />
                    <span>{item}</span>
                  </li>
                ))}
                <li className="pl-7 text-[13px] leading-[1.7] text-ink-4">제가 배워야 할 분들이라 도움이 되기 어렵습니다.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 후기 */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-6xl px-6 lg:px-10">
            <h2 className="mb-3 text-[28px] font-extrabold leading-[1.25] tracking-[-0.035em] text-ink md:text-[36px]">후기</h2>
            <p className="mb-10 max-w-xl text-[15px] leading-[1.8] text-ink-4 md:text-[16px]">
              커피챗 플랫폼에 남겨주신 후기 {MENTORING_REVIEWS.length}건을 그대로 옮겼습니다. 이름과 회사명은 뺐습니다.
            </p>
            <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
              {reviews.map(review => (
                <blockquote
                  key={review.id}
                  className="mb-4 break-inside-avoid rounded-[20px] bg-surface p-6"
                >
                  <p className="text-[15px] leading-[1.85] text-ink-2">“{review.quote}”</p>
                  <footer className="mt-4 text-[13px] text-ink-4">{review.context}</footer>
                </blockquote>
              ))}
            </div>
            {!showAllReviews && MENTORING_REVIEWS.length > REVIEW_PREVIEW_COUNT && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllReviews(true)}
                  className="h-11 rounded-[12px] border border-line bg-surface px-5 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft"
                >
                  {MENTORING_REVIEWS.length - REVIEW_PREVIEW_COUNT}건 더 보기
                </button>
              </div>
            )}
          </div>
        </section>

        {/* 진행 방식 */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-5xl px-6 lg:px-10">
            <h2 className="mb-3 text-[28px] font-extrabold leading-[1.25] tracking-[-0.035em] text-ink md:text-[36px]">신청 방법</h2>
            <p className="mb-10 text-[15px] leading-[1.8] text-ink-4 md:text-[16px]">세 단계면 됩니다.</p>
            <ol className="grid gap-4 md:grid-cols-3">
              {MENTORING_STEPS.map(item => (
                <li key={item.step} className="rounded-[20px] bg-surface p-6">
                  <p className="mb-3 text-[13px] font-bold text-brand-ink">
                    {item.step}
                  </p>
                  <h3 className="mb-2 text-[17px] font-bold text-ink">{item.title}</h3>
                  <p className="text-[14.5px] leading-[1.8] text-ink-3">{item.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-[14px] leading-[1.8] text-ink-4">
              궁금한 점은{" "}
              <a href={MENTORING_OPEN_CHAT_URL} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink underline underline-offset-2 hover:text-brand">
                오픈카톡
              </a>
              으로 남겨주시면 가능한 한 빨리 답변드리겠습니다.
            </p>
          </div>
        </section>

        {/* 리포트로 잇는 한 줄 + 푸터 */}
        <section className="border-t border-line py-16">
          <div className="mx-auto w-full max-w-2xl px-6 text-center lg:px-10">
            <p className="text-[14px] leading-[1.8] text-ink-4">
              한 분 한 분 다 만나기 어려워 만든 것이 <BrandName variant="default" /> 입니다. 자소서가 이미 있다면 세션 전에 한 번 돌려보세요. 첫 1회는 무료입니다.
            </p>
            <Link
              href="/analyze"
              className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink transition-colors hover:text-brand"
            >
              자소서 무료로 분석하기
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
            <p className="mt-10 text-[12px] text-ink-4">
              &copy; 2026 <BrandName variant="default" />. All rights reserved.{" "}
              <Link href="/privacy" className="ml-1 text-ink-3 transition-colors hover:text-ink">
                개인정보처리방침
              </Link>{" "}
              &middot;{" "}
              <Link href="/terms" className="text-ink-3 transition-colors hover:text-ink">
                이용약관
              </Link>{" "}
              &middot;{" "}
              <Link href="/help" className="text-ink-3 transition-colors hover:text-ink">
                고객센터
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
