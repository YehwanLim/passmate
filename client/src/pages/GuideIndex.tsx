import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { GuideCover } from "@/components/guide/GuideCover";
import { GuideCtaCard } from "@/components/guide/GuideCtaCard";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { formatDate } from "@/lib/formatDate";
import {
  GUIDE_SUMMARIES,
  guideCategories,
  guideCoverStyle,
  guidePath,
  readingMinutes,
} from "@/lib/guideSummaries";
import { GUIDE_INDEX_DESCRIPTION } from "@/lib/seo";
import { cn } from "@/lib/utils";

const ALL = "전체";

/**
 * /guide — 취업 가이드 목록. 매거진식: 최신 글 하나를 크게, 나머지는 3열 카드.
 * 커버 번호·색은 전체 목록에서의 위치로 정하므로 탭으로 걸러도 같은 글은 같은 커버다.
 * 메타는 lib/seo.ts 의 "/guide" 항목을 RouteMeta 가 적용한다.
 */
export default function GuideIndex() {
  const [category, setCategory] = useState(ALL);
  const categories = guideCategories(GUIDE_SUMMARIES);
  const visible = GUIDE_SUMMARIES.map((guide, index) => ({ guide, cover: guideCoverStyle(index) })).filter(
    ({ guide }) => category === ALL || guide.category === category
  );
  const [featured, ...rest] = visible;

  return (
    <GuideLayout>
      <div className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-[13px] font-medium text-blue-300">취업 가이드</p>
          <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.03em] md:text-[44px]">
            자소서를 내기 전에 읽는 글
          </h1>
          <p className="text-[15px] leading-7 text-gray-400 md:text-[16px]">{GUIDE_INDEX_DESCRIPTION}</p>
        </div>
        <div className="-mx-6 flex gap-5 overflow-x-auto px-6 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="가이드 분류">
          {[ALL, ...categories].map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={category === tab}
              onClick={() => setCategory(tab)}
              className={cn(
                "whitespace-nowrap border-b py-1.5 text-[13px] font-medium transition-colors",
                category === tab ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {featured && (
        <section className="grid grid-cols-1 gap-6 border-b border-white/[0.08] pb-12 lg:grid-cols-12 lg:gap-10 lg:pb-14">
          <Link href={guidePath(featured.guide)} className="block lg:col-span-7">
            <GuideCover size="featured" hue={featured.cover.hue} number={featured.cover.number} title={featured.guide.title} />
          </Link>
          <div className="flex flex-col justify-end gap-4 lg:col-span-5 lg:py-2">
            <span className="text-[12px] text-zinc-500">
              {featured.guide.category} · {formatDate(featured.guide.date, "ymd-dot")} ·{" "}
              {readingMinutes(featured.guide.bodyChars)}분 읽기
            </span>
            <p className="text-[16px] leading-[1.75] text-zinc-300 md:text-[17px]">{featured.guide.description}</p>
            <Link
              href={guidePath(featured.guide)}
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-white transition-colors hover:text-zinc-300"
            >
              글 읽기
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="grid grid-cols-1 gap-8 pt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {rest.map(({ guide, cover }) => (
            <Link key={guide.slug} href={guidePath(guide)} className="group flex flex-col gap-3.5">
              <GuideCover size="card" hue={cover.hue} number={cover.number} title={guide.title} className="transition-colors group-hover:border-white/[0.18]" />
              <p className="text-[14px] leading-[1.7] text-gray-400">{guide.description}</p>
              <span className="text-[12px] text-zinc-500">
                {guide.category} · {formatDate(guide.date, "ymd-dot")} · {readingMinutes(guide.bodyChars)}분 읽기
              </span>
            </Link>
          ))}
        </section>
      )}

      {visible.length === 0 && <p className="py-16 text-center text-[15px] text-zinc-500">이 분류의 글은 아직 없습니다.</p>}

      <GuideCtaCard
        className="mt-20 md:mt-24"
        title="읽는 것만으로는 내 자소서가 어떻게 읽히는지 알 수 없습니다"
        body="기업·직무와 문항을 넣으면 1분 안에 채용 담당자 시선의 리포트를 받습니다. 첫 분석은 무료입니다."
      />
    </GuideLayout>
  );
}
