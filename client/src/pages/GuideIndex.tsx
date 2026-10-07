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
  guideCoverTone,
  guidePath,
  readingMinutes,
} from "@/lib/guideSummaries";
import { cn } from "@/lib/utils";

const ALL = "전체";
// 화면 머리말. 검색 설명(lib/seo.ts GUIDE_INDEX_DESCRIPTION)과는 따로 둔다.
const INTRO = "커피챗에서 취준생 자소서를 고쳐 주며 자주 본 실수와, 직접 본 면접에서 실제로 받은 질문을 모았어요.";

/**
 * /guide — 취업 가이드 목록. 최신 글 하나를 크게, 나머지는 3열 카드.
 * 커버는 글의 이미지 또는 "이 글이 필요한 상황" 한 줄. 색은 전체 목록에서의 위치로 정하므로 탭으로 걸러도 같은 글은 같은 커버다.
 * 메타는 lib/seo.ts 의 "/guide" 항목을 RouteMeta 가 적용한다.
 */
export default function GuideIndex() {
  const [category, setCategory] = useState(ALL);
  const categories = guideCategories(GUIDE_SUMMARIES);
  const visible = GUIDE_SUMMARIES.map((guide, index) => ({ guide, cover: guideCoverTone(guide, index) })).filter(
    ({ guide }) => category === ALL || guide.category === category
  );
  const [featured, ...rest] = visible;

  return (
    <GuideLayout>
      <div className="mb-12 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-[14px] font-semibold text-brand-ink">취업 가이드</p>
          <h1 className="text-[32px] font-extrabold leading-[1.2] tracking-[-0.035em] text-ink md:text-[44px]">
            자소서·면접, 어디서부터 손댈지 모를 때
          </h1>
          <p className="text-[15px] leading-7 text-ink-3 md:text-[16px]">{INTRO}</p>
        </div>
        <div className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-1 lg:mx-0 lg:px-0" role="tablist" aria-label="가이드 분류">
          {[ALL, ...categories].map(tab => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={category === tab}
              onClick={() => setCategory(tab)}
              className={cn(
                "h-9 whitespace-nowrap rounded-[10px] px-3.5 text-[15px] transition-colors",
                category === tab ? "bg-ink font-bold text-white" : "font-semibold text-ink-4 hover:bg-fill hover:text-ink-2"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {featured && (
        <section className="grid grid-cols-1 gap-6 rounded-[28px] bg-surface p-4 md:p-6 lg:grid-cols-12 lg:gap-10">
          <Link href={guidePath(featured.guide)} className="block lg:col-span-6">
            <GuideCover tone={featured.cover} text={featured.guide.coverText} image={featured.guide.cover} />
          </Link>
          <div className="flex flex-col justify-end gap-4 px-2 pb-2 lg:col-span-6 lg:px-0 lg:py-2">
            <Link href={guidePath(featured.guide)}>
              <h2 className="text-[24px] font-bold leading-[1.3] tracking-[-0.02em] text-balance text-ink [word-break:keep-all] md:text-[30px]">
                {featured.guide.title}
              </h2>
            </Link>
            <span className="text-[13px] text-ink-4">
              {formatDate(featured.guide.date, "ymd-dot")} · {readingMinutes(featured.guide.bodyChars)}분 읽기
            </span>
            <Link
              href={guidePath(featured.guide)}
              className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand-ink transition-colors hover:text-brand"
            >
              글 읽기
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map(({ guide, cover }) => (
            <Link key={guide.slug} href={guidePath(guide)} className="group flex flex-col gap-3.5 rounded-[28px] bg-surface p-4 pb-5">
              <GuideCover
                tone={cover}
                text={guide.coverText}
                image={guide.cover}
                className="transition-transform duration-200 group-hover:-translate-y-1"
              />
              <h3 className="px-1 text-[15px] font-semibold leading-[1.45] text-balance text-ink [word-break:keep-all] md:text-[16px]">
                {guide.title}
              </h3>
              <span className="px-1 text-[13px] text-ink-4">
                {formatDate(guide.date, "ymd-dot")} · {readingMinutes(guide.bodyChars)}분 읽기
              </span>
            </Link>
          ))}
        </section>
      )}

      {visible.length === 0 && <p className="py-16 text-center text-[15px] text-ink-4">이 분류의 글은 아직 없습니다.</p>}

      <GuideCtaCard
        className="mt-20 md:mt-24"
        title="다 쓴 자소서, 내기 전에 한 번 읽혀 보세요"
        body="지원 회사와 문항을 넣으면 채용 담당자가 읽는 순서대로 첫인상과 고칠 곳을 짚어 드려요. 첫 분석은 무료예요."
      />
    </GuideLayout>
  );
}
