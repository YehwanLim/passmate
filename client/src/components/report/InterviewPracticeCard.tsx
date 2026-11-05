import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

import { INTERVIEW_CARD_COPY, INTERVIEW_MODE_COPY } from "@/copy/interviewCopy";
import { useCreditSummary } from "@/hooks/useCreditSummary";

/**
 * 리포트 예상 질문 아래: 이 리포트로 AI 면접 연습을 시작하는 입구.
 * 스위치가 꺼져 있거나(요약에 interviewEnabled 없음) 요약을 못 읽으면 아무것도 그리지 않는다 — 배포돼도 기본은 보이지 않는다.
 */
export default function InterviewPracticeCard({ analysisId, enabled = true }: { analysisId: string; enabled?: boolean }) {
  const { summary } = useCreditSummary(enabled);
  if (!summary || !summary.interviewEnabled) return null;
  const remaining = summary.interviewRemaining;
  const startPath = (mode: "FULL" | "SHORT") => `/my/interview-practice/start?analysisId=${encodeURIComponent(analysisId)}&mode=${mode}`;

  return (
    <section className="print:hidden rounded-3xl bg-surface px-6 py-8 md:px-10 md:py-9" aria-labelledby="interview-practice-heading">
      <p className="text-[14px] font-bold text-brand-ink">{INTERVIEW_CARD_COPY.label}</p>
      <h3 id="interview-practice-heading" className="mt-2 text-[20px] font-bold text-ink text-balance">{INTERVIEW_CARD_COPY.heading}</h3>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 text-pretty">{INTERVIEW_CARD_COPY.description}</p>
      {remaining > 0 ? (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={startPath("FULL")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-soft px-6 py-3.5 font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff] sm:w-auto"
          >
            <span>{INTERVIEW_MODE_COPY.FULL.label}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={startPath("SHORT")}
            className="inline-flex w-full items-center justify-center rounded-xl px-6 py-3.5 font-semibold text-ink-3 transition-colors hover:bg-fill sm:w-auto"
          >
            {INTERVIEW_MODE_COPY.SHORT.label}
          </Link>
          <span className="text-[13px] text-ink-4">{INTERVIEW_CARD_COPY.remaining(remaining)}</span>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="text-[14px] text-ink-4">{INTERVIEW_CARD_COPY.none}</p>
          {/* 결제 URL 은 서버가 스위치·상품 설정으로 판단한다. 없으면 구매 버튼도 없다. */}
          {summary.checkoutUrls?.interview && (
            <Link
              href="/checkout?product=interview"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-soft px-6 py-3 font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff] sm:w-auto"
            >
              <span>{INTERVIEW_CARD_COPY.buy}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
      <Link href={`/my/interview-practice?analysisId=${encodeURIComponent(analysisId)}`} className="mt-4 inline-block text-[14px] font-semibold text-ink-4 underline-offset-4 hover:underline">
        {INTERVIEW_CARD_COPY.history}
      </Link>
    </section>
  );
}
