import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { GuideCover } from "@/components/guide/GuideCover";
import { GUIDE_SUMMARIES, guideCoverStyle, guidePath, readingMinutes } from "@/lib/guideSummaries";
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
    <section className="py-28 md:py-36 border-t border-white/[0.04]" aria-labelledby="guide-teaser-title">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-10">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] font-medium text-blue-300">취업 가이드</p>
            <h2 id="guide-teaser-title" className="text-3xl md:text-4xl font-bold tracking-tight">
              채용 담당자가 진짜 보는 것
            </h2>
            <p className="max-w-xl text-gray-500 font-light text-[15px] leading-[1.8]">
              리포트가 매번 짚는 기준을 글로 정리했습니다. 읽고 나면 내 자소서에서 어디부터 고칠지 보입니다.
            </p>
          </div>
          <Link
            href={GUIDE_INDEX_PATH}
            className="inline-flex h-10 flex-none items-center gap-2 rounded-lg border border-white/[0.12] px-4 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
          >
            가이드 전체 보기
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {guides.map((guide, index) => {
            const cover = guideCoverStyle(index);
            return (
              <Link key={guide.slug} href={guidePath(guide)} className="group flex flex-col gap-3">
                <GuideCover
                  size="card"
                  hue={cover.hue}
                  number={cover.number}
                  title={guide.title}
                  className="transition-colors group-hover:border-white/[0.18]"
                />
                <span className="text-[12px] text-zinc-500">
                  {guide.category} · {readingMinutes(guide.bodyChars)}분 읽기
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
