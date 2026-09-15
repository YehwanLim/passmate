import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";
import { cn } from "@/lib/utils";

/** 가이드 목록·본문 끝의 분석 유도. 강조는 색이 아니라 흰 버튼(톤)으로. */
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
        "rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 md:p-8",
        className
      )}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between md:gap-10">
        <div className="flex flex-col gap-2">
          {title && <h2 className="text-xl font-bold tracking-[-0.02em] md:text-2xl">{title}</h2>}
          <p className="text-[15px] leading-7 text-gray-400">{body}</p>
        </div>
        <div className="flex flex-wrap gap-3 md:flex-none">
          <Link
            href="/analyze"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[14px] font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            내 자소서 무료로 분석하기
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {withSample && (
            <Link
              href={RESUME_REPORT_SAMPLE_PATH}
              className="inline-flex h-11 items-center rounded-lg border border-white/[0.12] px-5 text-[14px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
            >
              예시 리포트 보기
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
