import { useLayoutEffect, useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { Link, useParams } from "wouter";
import { GuideCover } from "@/components/guide/GuideCover";
import { GuideCtaCard } from "@/components/guide/GuideCtaCard";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { formatDate } from "@/lib/formatDate";
import { findGuide, guideMeta, renderGuideHtml } from "@/lib/guides";
import { GUIDE_SUMMARIES, guideCoverStyle, guideIndexOf, guidePath, readingMinutes } from "@/lib/guideSummaries";
import { applyDocumentMeta, GUIDE_INDEX_PATH, SEO_ROUTES } from "@/lib/seo";
import NotFound from "./NotFound";

const RELATED_COUNT = 3;

/**
 * /guide/:slug — 가이드 본문. RouteMeta 가 먼저 넣는 일반 가이드 메타를 frontmatter 기반 메타로 덮어쓴다
 * (형제 순서상 RouteMeta 의 layout effect 가 먼저, 이 페이지의 layout effect 가 나중에 돈다).
 * 본문 HTML 은 레포 저자가 쓴 마크다운(client/content/guides)에서만 나오므로 sanitize 하지 않는다.
 */
export default function GuideArticle() {
  const { slug } = useParams<{ slug: string }>();
  const guide = findGuide(slug);

  useLayoutEffect(() => {
    applyDocumentMeta(guide ? guideMeta(guide) : SEO_ROUTES["/404"]);
  }, [guide]);

  const html = useMemo(() => (guide ? renderGuideHtml(guide.body) : ""), [guide]);

  if (!guide) return <NotFound />;

  const index = guideIndexOf(guide.slug);
  const cover = guideCoverStyle(index);
  const related = GUIDE_SUMMARIES.map((summary, summaryIndex) => ({ summary, cover: guideCoverStyle(summaryIndex) }))
    .filter(({ summary }) => summary.slug !== guide.slug)
    .slice(0, RELATED_COUNT);
  const metaLine = `${guide.category} · ${formatDate(guide.updated, "ymd-dot")} · ${readingMinutes(guide.bodyChars)}분 읽기`;

  return (
    <GuideLayout>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <article className="lg:col-span-7 lg:col-start-2">
          <nav aria-label="현재 위치" className="flex items-center gap-2 text-[12px] text-zinc-500">
            <Link href={GUIDE_INDEX_PATH} className="text-zinc-400 transition-colors hover:text-white">
              취업 가이드
            </Link>
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
            <span>{guide.category}</span>
          </nav>

          <GuideCover size="band" hue={cover.hue} number={cover.number} className="mt-7">
            <span className="relative z-10 text-[13px] text-white/70">{metaLine}</span>
          </GuideCover>

          <header className="mt-9">
            <h1 className="text-[30px] font-bold leading-[1.2] tracking-[-0.03em] [word-break:keep-all] md:text-[40px]">
              {guide.title}
            </h1>
            <p className="mt-4 text-[16px] leading-[1.7] text-gray-400 md:text-[18px]">{guide.description}</p>
          </header>

          <div
            className="guide-prose prose prose-invert mt-9 max-w-none border-t border-white/[0.08] pt-2 prose-headings:tracking-normal prose-h2:text-xl prose-h2:mt-11 prose-h3:text-lg prose-p:leading-7 prose-li:leading-7 prose-a:text-blue-300 prose-a:no-underline hover:prose-a:underline prose-strong:text-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          <GuideCtaCard
            className="mt-12"
            body="글로 익힌 기준을 내 자소서에 바로 대 보세요. 기업·직무와 문항을 넣으면 1분 안에 채용 담당자 시선의 리포트를 받습니다. 첫 분석은 무료입니다."
            withSample
          />
        </article>

        {related.length > 0 && (
          <aside className="flex flex-col gap-3.5 lg:col-span-3 lg:col-start-10 lg:pt-[292px]">
            <span className="text-[12px] font-semibold tracking-[0.06em] text-zinc-500">이어서 읽기</span>
            {related.map(({ summary, cover: relatedCover }) => (
              <Link
                key={summary.slug}
                href={guidePath(summary)}
                className="flex items-center gap-4 rounded-[10px] border border-white/[0.08] bg-white/[0.03] p-3.5 transition-colors hover:border-white/[0.18] hover:bg-white/[0.05]"
              >
                <GuideCover size="mini" hue={relatedCover.hue} number={relatedCover.number} />
                <span className="text-[14px] font-semibold leading-[1.45] text-white [word-break:keep-all]">{summary.title}</span>
              </Link>
            ))}
            <Link href={GUIDE_INDEX_PATH} className="mt-1.5 text-[13px] font-medium text-zinc-400 transition-colors hover:text-white">
              가이드 전체 보기 →
            </Link>
          </aside>
        )}
      </div>
    </GuideLayout>
  );
}
