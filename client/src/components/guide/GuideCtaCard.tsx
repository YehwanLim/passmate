import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";
import { cn } from "@/lib/utils";

/** 가이드 목록·본문 끝의 분석 유도. 강조는 파란 주 버튼 하나, 예시 리포트는 흰 보조 버튼. */
export function GuideCtaCard({
  title,
  body,
  withSample = false,
  className,
}: {
  title?: string;
  body: string;
  withSample?: boolean;
  className?: string;
}) {
  return (
    <section
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
            href="/analyze"
            className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            내 자소서 무료로 분석하기
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {withSample && (
            <Link
              href={RESUME_REPORT_SAMPLE_PATH}
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
