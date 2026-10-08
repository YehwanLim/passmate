import { useLayoutEffect, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { Link, useParams } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { findJobPosting, type JobPostingListing } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS, type JobPostingDetail } from "@/constants/jobPostingDetails";
import { useNow } from "@/hooks/useNow";
import { dDayLabel, formatDeadline, isOpen } from "@/lib/jobPostingDates";
import { jobPostingMeta } from "@/lib/jobPostingMeta";
import { applyDocumentMeta, JOBS_INDEX_PATH, SEO_ROUTES } from "@/lib/seo";
import NotFound from "./NotFound";

/** "\n" 으로 나눈 문단 */
function Paragraphs({ text, className }: { text: string; className: string }) {
  return (
    <>
      {text.split("\n").filter(Boolean).map((line, index) => (
        <p key={index} className={className}>
          {line}
        </p>
      ))}
    </>
  );
}

function Panel({ title, note, children }: { title: string; note?: string | null; children: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-surface px-6 py-6 md:px-8 md:py-7">
      <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">
        {title}
        {note && <span className="ml-2 text-[13px] font-medium tracking-normal text-ink-4">{note}</span>}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 이 공고로 바로 시작하기. 회사와 공고(slug)를 쿼리로 넘겨 받는 화면이 회사·문항·마감을 채운다. */
function StartCard({ listing }: { listing: JobPostingListing }) {
  const company = encodeURIComponent(listing.company);
  const button = "flex h-12 w-full items-center justify-center rounded-[12px] text-[15px] font-bold transition-colors";
  return (
    <aside className="rounded-[24px] bg-surface p-6 lg:sticky lg:top-24">
      <h2 className="text-[17px] font-bold text-ink">이 공고로 자소서 준비하기</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-4 [word-break:keep-all]">
        회사 이름과 공고 내용이 채워진 채로 시작해요.
      </p>
      <div className="mt-5 grid gap-2.5">
        <Link href={`/my/new?job=${listing.slug}`} className={`${button} bg-brand text-white hover:bg-brand-hover`}>
          내 경험으로 초안 쓰기
        </Link>
        <Link
          href={`/analyze?company=${company}&job=${listing.slug}`}
          className={`${button} bg-brand-soft text-brand-ink hover:bg-[#dde9ff]`}
        >
          다 쓴 자소서 분석하기
        </Link>
        <Link
          href={`/company-analysis?company=${company}`}
          className={`${button} border border-line bg-surface text-ink-2 hover:bg-fill-soft`}
        >
          이 회사 기업 분석 보기
        </Link>
      </div>
    </aside>
  );
}

function PostingBody({ detail }: { detail: JobPostingDetail }) {
  return (
    <div className="grid gap-5">
      <Panel title="핵심 정보">
        <dl className="grid grid-cols-1 border-t border-line text-[15px] sm:grid-cols-[120px_minmax(0,1fr)]">
          {detail.facts.map(fact => (
            <div key={fact.label} className="contents">
              <dt className="pt-3 text-ink-4 sm:border-b sm:border-line-soft sm:py-3">{fact.label}</dt>
              <dd className="border-b border-line-soft pb-3 pt-1 text-ink-2 [word-break:keep-all] sm:py-3">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {detail.questions.length > 0 ? (
        <Panel title="자소서 문항" note={detail.questionsNote}>
          <ol className="divide-y divide-line-soft">
            {detail.questions.map((question, index) => (
              <li key={question.prompt} className="py-5 first:pt-0 last:pb-0">
                <p className="text-[16px] font-bold leading-relaxed text-ink [word-break:keep-all]">
                  Q{index + 1}. {question.prompt}
                  {question.charLimit !== null && (
                    <span className="ml-1.5 text-[13px] font-medium text-ink-4">{question.charLimit.toLocaleString()}자</span>
                  )}
                </p>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-3 [word-break:keep-all]">
                  <b className="mr-1.5 font-semibold text-ink-2">무엇을 묻나</b>
                  {question.ask}
                </p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-3 [word-break:keep-all]">
                  <b className="mr-1.5 font-semibold text-ink-2">이렇게 써 보세요</b>
                  {question.how}
                </p>
              </li>
            ))}
          </ol>
        </Panel>
      ) : (
        <p className="px-1 text-[15px] text-ink-3">자소서 문항은 공고에 없고 지원서 화면에서 공개돼요. 공고의 담당 업무와 우대사항으로 정리했어요.</p>
      )}

      {detail.tips.length > 0 && (
        <Panel title="직무별로 이렇게 써 보세요">
          <div className="divide-y divide-line-soft">
            {detail.tips.map(tip => (
              <div key={tip.title} className="py-5 first:pt-0 last:pb-0">
                <h3 className="text-[16px] font-bold text-ink [word-break:keep-all]">{tip.title}</h3>
                <div className="mt-2 grid gap-2">
                  <Paragraphs text={tip.body} className="text-[15px] leading-relaxed text-ink-3 [word-break:keep-all]" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {detail.checks.length > 0 && (
        <Panel title="지원 전에 확인할 것">
          <ul className="grid gap-2">
            {detail.checks.map(check => (
              <li key={check} className="flex gap-2 text-[15px] leading-relaxed text-ink-2 [word-break:keep-all]">
                <span className="text-ink-5" aria-hidden="true">
                  ·
                </span>
                {check}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <a
        href={detail.source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="px-1 text-[14px] font-semibold text-brand-ink underline-offset-4 hover:underline"
      >
        공식 공고 보기 ↗ {detail.source.label}
      </a>
    </div>
  );
}

/**
 * /jobs/:slug — 공고 한 장. RouteMeta 가 먼저 넣는 기본 메타를 공고별 메타로 덮어쓴다(GuideArticle 과 같은 방식).
 * 빌드 때 프리렌더된다. D-n·마감 표시는 useNow() 가 있을 때만(하이드레이션 뒤) 붙는다.
 */
export default function JobPostingPage() {
  const { slug } = useParams<{ slug: string }>();
  const listing = findJobPosting(slug);
  const detail = listing ? JOB_POSTING_DETAILS[listing.slug] : undefined;
  const now = useNow();

  useLayoutEffect(() => {
    applyDocumentMeta(listing && detail ? jobPostingMeta(listing, detail) : SEO_ROUTES["/404"]);
  }, [listing, detail]);

  if (!listing || !detail) return <NotFound />;

  const closed = now !== null && !isOpen(listing.closesAt, now);

  return (
    <GuideLayout>
      <Link
        href={JOBS_INDEX_PATH}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-4 transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-3 w-3" aria-hidden="true" />
        채용 공고
      </Link>

      {closed && (
        <p className="mt-6 rounded-[16px] bg-fill px-5 py-3.5 text-[15px] text-ink-2">
          마감된 공고예요. 문항과 쓰는 법은 다음 시즌 준비에 참고하세요.
        </p>
      )}

      <header className="mt-6 max-w-3xl">
        <h1 className="text-[30px] font-extrabold leading-[1.25] tracking-[-0.035em] text-balance text-ink [word-break:keep-all] md:text-[40px]">
          {listing.title}
        </h1>
        <p className="mt-3 text-[15px] text-ink-3 [word-break:keep-all]">
          {listing.subtitle} · {formatDeadline(listing.closesAt)} 마감
          {now && !closed && <b className="ml-1.5 font-bold text-danger">{dDayLabel(listing.closesAt, now)}</b>}
        </p>
        <p className="mt-4 text-[16px] leading-[1.75] text-ink-2 [word-break:keep-all] md:text-[17px]">{detail.highlight}</p>
      </header>

      <div className="mt-8 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <PostingBody detail={detail} />
        <StartCard listing={listing} />
      </div>
    </GuideLayout>
  );
}
