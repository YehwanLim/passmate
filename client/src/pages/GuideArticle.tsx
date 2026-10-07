import { Suspense, useLayoutEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "wouter";
import { GuideCover } from "@/components/guide/GuideCover";
import { GuideCtaCard } from "@/components/guide/GuideCtaCard";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { formatDate } from "@/lib/formatDate";
import { hasGuideBody, readGuideHtml } from "@/lib/guideBodies";
import { guideMeta } from "@/lib/guideMeta";
import { GUIDE_SUMMARIES, guideCoverTone, guideIndexOf, guidePath, readingMinutes } from "@/lib/guideSummaries";
import { applyDocumentMeta, GUIDE_INDEX_PATH, SEO_ROUTES } from "@/lib/seo";
import NotFound from "./NotFound";

const RELATED_COUNT = 3;

// 흰 바탕에서 길게 읽는 본문: 17px·줄 간격 1.8, 인용은 왼쪽 줄 대신 회색 판, 링크는 브랜드 글씨 + 밑줄.
const PROSE_CLASS =
  "guide-prose prose mt-9 max-w-none border-t border-line pt-2 text-[17px] text-ink-2 prose-headings:font-bold prose-headings:tracking-[-0.02em] prose-headings:text-ink prose-h2:text-[22px] prose-h2:mt-11 prose-h3:text-[19px] prose-p:leading-[1.8] prose-li:leading-[1.8] prose-a:text-brand-ink prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-brand prose-strong:text-ink prose-blockquote:rounded-[16px] prose-blockquote:border-l-0 prose-blockquote:bg-fill prose-blockquote:px-6 prose-blockquote:py-1 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-ink-2 prose-th:text-ink prose-td:text-ink-2 prose-thead:border-line prose-tr:border-line-soft prose-img:mx-auto prose-img:w-auto prose-img:max-h-[600px] prose-img:rounded-[16px] prose-img:border prose-img:border-line";

/** 본문. readGuideHtml 이 아직 못 받은 글이면 Promise 를 던지므로 Suspense 안에 둔다(lib/guideBodies.ts). */
function GuideBody({ slug }: { slug: string }) {
  return <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: readGuideHtml(slug) }} />;
}

/**
 * /guide/:slug — 가이드 본문. RouteMeta 가 먼저 넣는 일반 가이드 메타를 frontmatter 기반 메타로 덮어쓴다
 * (형제 순서상 RouteMeta 의 layout effect 가 먼저, 이 페이지의 layout effect 가 나중에 돈다).
 * 본문 HTML 은 레포 저자가 쓴 마크다운(client/content/guides)에서만 나오므로 sanitize 하지 않는다.
 * 메타·제목은 요약(GUIDE_SUMMARIES)에서, 본문은 글 하나씩(lib/guideBodies.ts) 온다 — 모든 글의 원문을 한 청크에 싣지 않는다.
 */
export default function GuideArticle() {
  const { slug } = useParams<{ slug: string }>();
  const guide = slug && hasGuideBody(slug) ? GUIDE_SUMMARIES.find(summary => summary.slug === slug) : undefined;

  useLayoutEffect(() => {
    applyDocumentMeta(guide ? guideMeta(guide) : SEO_ROUTES["/404"]);
  }, [guide]);

  if (!guide) return <NotFound />;

  const index = guideIndexOf(guide.slug);
  const cover = guideCoverTone(guide, index);
  // 이어서 읽기: 같은 분류를 먼저, 모자라면 최신순으로 채운다. 분류별로 내부 링크가 묶여야 검색엔진이 주제 묶음으로 읽는다.
  const others = GUIDE_SUMMARIES.map((summary, summaryIndex) => ({ summary, cover: guideCoverTone(summary, summaryIndex) })).filter(
    ({ summary }) => summary.slug !== guide.slug
  );
  const related = [
    ...others.filter(({ summary }) => summary.category === guide.category),
    ...others.filter(({ summary }) => summary.category !== guide.category),
  ].slice(0, RELATED_COUNT);
  const metaLine = `${formatDate(guide.updated, "ymd-dot")} · ${readingMinutes(guide.bodyChars)}분 읽기`;

  return (
    <GuideLayout surface="white">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-10">
        <article className="lg:col-span-7 lg:col-start-2">
          <Link
            href={GUIDE_INDEX_PATH}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-4 transition-colors hover:text-ink"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
            취업 가이드
          </Link>

          <GuideCover tone={cover} text={guide.coverText} image={guide.cover} className="mt-7 w-full max-w-[400px]" />

          <header className="mt-9">
            <h1 className="text-[30px] font-extrabold leading-[1.25] tracking-[-0.035em] text-balance text-ink [word-break:keep-all] md:text-[40px]">
              {guide.title}
            </h1>
            <p className="mt-3 text-[13px] text-ink-4">{metaLine}</p>
            <p className="mt-4 text-[16px] leading-[1.7] text-ink-3 md:text-[18px]">{guide.description}</p>
          </header>

          <Suspense fallback={<div className="mt-9 min-h-[60vh] border-t border-line" aria-busy="true" />}>
            <GuideBody slug={guide.slug} />
          </Suspense>

          <GuideCtaCard
            className="mt-12 bg-fill"
            title="다 쓴 자소서, 내기 전에 한 번 읽혀 보세요"
            body="지원 회사와 문항을 넣으면 채용 담당자가 읽는 순서대로 첫인상과 고칠 곳을 짚어 드려요. 첫 분석은 무료예요."
            withSample
          />
        </article>

        {related.length > 0 && (
          <aside className="flex flex-col gap-3.5 lg:col-span-3 lg:col-start-10 lg:pt-[292px]">
            <span className="text-[13px] font-semibold text-ink-4">이어서 읽기</span>
            {related.map(({ summary, cover: relatedCover }) => (
              <Link
                key={summary.slug}
                href={guidePath(summary)}
                className="flex items-center gap-4 rounded-[16px] border border-line bg-surface p-3.5 transition-colors hover:bg-fill-soft"
              >
                <GuideCover tone={relatedCover} image={summary.cover} mini className="w-16 flex-none" />
                <span className="text-[14px] font-semibold leading-[1.45] text-balance text-ink [word-break:keep-all]">{summary.title}</span>
              </Link>
            ))}
            <Link href={GUIDE_INDEX_PATH} className="mt-1.5 text-[13px] font-semibold text-brand-ink transition-colors hover:text-brand">
              가이드 전체 보기 →
            </Link>
          </aside>
        )}
      </div>
    </GuideLayout>
  );
}
