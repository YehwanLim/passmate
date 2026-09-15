import { ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { formatDate } from "@/lib/formatDate";
import { GUIDES, guidePath } from "@/lib/guides";
import { GUIDE_INDEX_DESCRIPTION } from "@/lib/seo";

/** /guide — 취업 가이드 목록. 메타는 lib/seo.ts 의 "/guide" 항목을 RouteMeta 가 적용한다. */
export default function GuideIndex() {
  return (
    <GuideLayout backHref="/" backLabel="홈으로">
      <div className="mb-10">
        <p className="mb-3 text-[13px] font-medium text-blue-300">취업 가이드</p>
        <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
          자소서를 내기 전에 읽는 글
        </h1>
        <p className="mt-4 text-[15px] leading-7 text-gray-400">{GUIDE_INDEX_DESCRIPTION}</p>
      </div>

      <ul className="space-y-4">
        {GUIDES.map(guide => (
          <li key={guide.slug}>
            <Link
              href={guidePath(guide)}
              className="block rounded-lg border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.16] hover:bg-white/[0.05]"
            >
              <time dateTime={guide.date} className="text-[12px] text-zinc-500">
                {formatDate(guide.date, "ymd-dot")}
              </time>
              <h2 className="mt-2 text-lg font-semibold tracking-normal text-white">{guide.title}</h2>
              <p className="mt-2 text-[14.5px] leading-7 text-gray-400">{guide.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-300">
                읽기
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-14 rounded-lg border border-white/[0.08] bg-white/[0.03] p-6">
        <p className="text-[15px] leading-7 text-gray-300">
          읽는 것만으로는 내 자소서가 어떻게 읽히는지 알 수 없습니다. 기업·직무와 문항을 넣으면 1분 안에 채용 담당자
          시선의 리포트를 받습니다. 첫 분석은 무료입니다.
        </p>
        <Link
          href="/analyze"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          내 자소서 무료로 분석하기
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </GuideLayout>
  );
}
