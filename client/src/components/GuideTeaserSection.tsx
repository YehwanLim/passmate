import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { GuideCover } from "@/components/guide/GuideCover";
import { GUIDE_SUMMARIES, guideCoverTone, guidePath, readingMinutes } from "@/lib/guideSummaries";
import { GUIDE_INDEX_PATH } from "@/lib/seo";

const TEASER_COUNT = 3;

/**
 * 랜딩의 취업 가이드 진입 섹션. 최신 3편만 보여주고 나머지는 목록으로 보낸다.
 * lib/guideSummaries(본문 없음)만 읽어 마크다운 원문이 랜딩 번들에 실리지 않는다.
 */
export default function GuideTeaserSection() {
  const guides = GUIDE_SUMMARIES.slice(0, TEASER_COUNT);
  if (guides.length === 0) return null;

  return (
    <section className="bg-fill-soft py-24 md:py-[120px]" aria-labelledby="guide-teaser-title">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="flex flex-col items-start gap-3.5">
            <span className="inline-flex h-7 items-center rounded-[8px] bg-line px-2.5 text-[13px] font-bold text-ink-3">취업 가이드</span>
            <h2 id="guide-teaser-title" className="text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink md:text-[46px]">
              채용 담당자가 진짜 보는 것
            </h2>
            <p className="max-w-xl text-[16px] leading-[1.7] text-ink-3 md:text-[17px]">
              리포트가 매번 짚는 기준을 글로 정리했습니다. 읽고 나면 내 자소서에서 어디부터 고칠지 보입니다.
            </p>
          </div>
          <Link
            href={GUIDE_INDEX_PATH}
            className="inline-flex h-[46px] w-fit flex-none items-center gap-1.5 rounded-[10px] bg-brand-soft px-[18px] text-[15px] font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff]"
          >
            가이드 전체 보기
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide, index) => {
            const cover = guideCoverTone(guide, index);
            return (
              <Link key={guide.slug} href={guidePath(guide)} className="group flex flex-col gap-3 rounded-[28px] bg-surface p-3.5 pb-[22px] transition-shadow hover:shadow-[0_12px_32px_rgba(18,32,90,0.08)]">
                <GuideCover
                  tone={cover}
                  text={guide.coverText}
                  image={guide.cover}
                  className="overflow-hidden rounded-[20px]"
                />

                <h3 className="px-2.5 pt-1 text-[16px] font-bold leading-[1.45] text-balance text-ink [word-break:keep-all]">

                  {guide.title}

                </h3>

                <span className="px-2.5 text-[14px] text-ink-4">{readingMinutes(guide.bodyChars)}분 읽기</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
