import { useLayoutEffect, useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useParams } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { formatDate } from "@/lib/formatDate";
import { findGuide, guideMeta, renderGuideHtml } from "@/lib/guides";
import { applyDocumentMeta, GUIDE_INDEX_PATH, SEO_ROUTES } from "@/lib/seo";
import { RESUME_REPORT_SAMPLE_PATH } from "@/constants/resumeReportSampleMeta";
import NotFound from "./NotFound";

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

  return (
    <GuideLayout backHref={GUIDE_INDEX_PATH} backLabel="가이드 목록">
      <article>
        <header className="mb-10">
          <p className="mb-3 text-[13px] font-medium text-blue-300">
            <time dateTime={guide.updated}>{formatDate(guide.updated, "ymd-dot")}</time>
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">{guide.title}</h1>
          <p className="mt-4 text-[15px] leading-7 text-gray-400">{guide.description}</p>
        </header>

        <div
          className="guide-prose prose prose-invert max-w-none prose-headings:tracking-normal prose-h2:text-xl prose-h2:mt-12 prose-h3:text-lg prose-p:leading-7 prose-li:leading-7 prose-a:text-blue-300 prose-a:no-underline hover:prose-a:underline prose-strong:text-white"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <footer className="mt-14 rounded-lg border border-white/[0.08] bg-white/[0.03] p-6">
          <p className="text-[15px] leading-7 text-gray-300">
            글로 익힌 기준을 내 자소서에 바로 대 보세요. 기업·직무와 문항을 넣으면 1분 안에 채용 담당자 시선의 리포트를
            받습니다. 첫 분석은 무료입니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/analyze"
              className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[13px] font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              내 자소서 무료로 분석하기
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={RESUME_REPORT_SAMPLE_PATH}
              className="inline-flex items-center gap-2 rounded-md border border-white/[0.12] px-4 py-2 text-[13px] font-medium text-zinc-200 transition-colors hover:bg-white/[0.06]"
            >
              예시 리포트 보기
            </Link>
          </div>
        </footer>
      </article>
    </GuideLayout>
  );
}
