import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";
import { INTERVIEW_INTENT_COPY } from "@/copy/interviewIntentCopy";
import { type AnalyzeIntent, withAnalyzeIntent } from "@/lib/analyze/analyzeIntent";
import { sendFunnelEvent } from "@/lib/siteVisits";
import { cn } from "@/lib/utils";

/**
 * 가이드 목록·본문 끝의 분석 유도. 강조는 파란 주 버튼 하나, 예시 리포트는 흰 보조 버튼.
 * analyzeHref 로 회사 이름을 채워 보낼 수 있고, trackSlug 가 있으면 누른 버튼을 기록한다(본문 글 끝).
 * intent=interview(면접 후기 글)면 버튼 문구가 예상 질문으로 바뀌고, 예시 리포트는 예상 질문 섹션부터 열며,
 * 기록 위치는 `guide-card-interview:<slug>`·`guide-sample-interview:<slug>` 로 나뉜다. analyzeHref 는 부르는 쪽이 intent 를 붙여 넘긴다.
 */
export function GuideCtaCard({
  id,
  title,
  body,
  withSample = false,
  analyzeHref = "/analyze",
  trackSlug,
  intent = null,
  className,
}: {
  id?: string;
  title?: string;
  body: string;
  withSample?: boolean;
  analyzeHref?: string;
  trackSlug?: string;
  intent?: AnalyzeIntent | null;
  className?: string;
}) {
  const track = (which: string) => () => {
    if (trackSlug) void sendFunnelEvent("content_cta_click", `guide-${which}${intent ? `-${intent}` : ""}:${trackSlug}`);
  };
  return (
    <section
      id={id}
      className={cn(
        "rounded-[28px] bg-surface p-6 md:p-8",
        className
      )}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="flex flex-col gap-2">
          {title && <h2 className="text-xl font-bold tracking-[-0.02em] text-ink md:text-2xl">{title}</h2>}
          <p className="text-[15px] leading-7 text-ink-3">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:flex-none">
          <Link
            href={analyzeHref}
            onClick={track("card")}
            className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            {intent === "interview" ? INTERVIEW_INTENT_COPY.cardButton : "내 자소서 무료로 분석하기"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {withSample && (
            <Link
              href={withAnalyzeIntent(RESUME_REPORT_SAMPLE_PATH, intent)}
              onClick={track("sample")}
              className="inline-flex h-11 items-center rounded-[12px] border border-line bg-surface px-5 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft"
            >
              예시 리포트 보기
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
