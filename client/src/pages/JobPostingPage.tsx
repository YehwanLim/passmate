import { useLayoutEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link, useParams } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { findJobPosting, type JobPostingListing } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS, type JobPostingDetail } from "@/constants/jobPostingDetails";
import { useNow } from "@/hooks/useNow";
import { dDayLabel, formatDeadline, isOpen } from "@/lib/jobPostingDates";
import { jobPostingMeta } from "@/lib/jobPostingMeta";
import { applyDocumentMeta, JOBS_INDEX_PATH, SEO_ROUTES } from "@/lib/seo";
import NotFound from "./NotFound";

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] bg-surface px-6 py-6 md:px-8 md:py-7">
      <h2 className="text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 여러 개를 나열하는 칸(모집 회사·직무)은 한 줄씩. "회사: 직무"면 앞을 굵게 해 회사 단위로 끊어 읽히게 한다. */
function FactValue({ value }: { value: string | readonly string[] }) {
  if (typeof value === "string") return <>{value}</>;
  return (
    <ul className="grid gap-1.5">
      {value.map(item => {
        const cut = item.indexOf(": ");
        return (
          <li key={item} className="flex gap-2">
            <span className="text-ink-5" aria-hidden="true">
              ·
            </span>
            <span>
              {cut > 0 ? (
                <>
                  <b className="font-semibold text-ink">{item.slice(0, cut)}</b> {item.slice(cut + 2)}
                </>
              ) : (
                item
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** 전형 절차를 번호 붙은 단계 칸으로. 부문마다 다르면 부문 이름을 붙여 줄을 나눈다. */
function ProcessSteps({ detail }: { detail: JobPostingDetail }) {
  return (
    <div className="grid gap-5">
      {detail.process.map(track => (
        <div key={track.name ?? "all"}>
          {track.name && <p className="mb-2.5 text-[14px] font-semibold text-ink-3">{track.name}</p>}
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
            {track.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="size-4 shrink-0 text-ink-5" aria-hidden="true" />}
                <span className="inline-flex items-center gap-2 rounded-[12px] bg-fill px-3 py-2 text-[15px] font-semibold text-ink [word-break:keep-all]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {detail.processNote && <p className="text-[14px] text-ink-4 [word-break:keep-all]">{detail.processNote}</p>}
    </div>
  );
}

/** 이 공고로 바로 시작하기. 회사와 공고(slug)를 쿼리로 넘겨 받는 화면이 회사·마감·공고 내용을 채운다. */
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
          자소서 분석하기
        </Link>
        <Link
          href={`/company-analysis?company=${company}&job=${listing.slug}`}
          className={`${button} border border-line bg-surface text-ink-2 hover:bg-fill-soft`}
        >
          기업 분석하기
        </Link>
      </div>
    </aside>
  );
}

function PostingBody({ detail }: { detail: JobPostingDetail }) {
  return (
    <div className="grid gap-5">
      {detail.process.length > 0 && (
        <Panel title="전형 절차">
          <ProcessSteps detail={detail} />
        </Panel>
      )}

      <Panel title="핵심 정보">
        <dl className="grid grid-cols-1 border-t border-line text-[15px] sm:grid-cols-[120px_minmax(0,1fr)]">
          {detail.facts.map(fact => (
            <div key={fact.label} className="contents">
              <dt className="pt-3 text-ink-4 sm:border-b sm:border-line-soft sm:py-3">{fact.label}</dt>
              <dd className="border-b border-line-soft pb-3 pt-1 text-ink-2 [word-break:keep-all] sm:py-3">
                <FactValue value={fact.value} />
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

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
          마감된 공고예요. 다음 시즌 공고가 열리면 새로 올려요.
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
        {/* 지원·정정 확인은 공식 공고가 기준이다. 우리는 요약만 두고 원문은 링크로 보낸다. */}
        <a
          href={detail.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 items-center rounded-[12px] border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft"
        >
          공식 공고 보기 ↗ {detail.source.label}
        </a>
        <p className="mt-2 text-[13px] text-ink-4">일정·자격은 바뀔 수 있어요. 지원 전에 공식 공고를 꼭 확인하세요.</p>
      </header>

      <div className="mt-8 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <PostingBody detail={detail} />
        <StartCard listing={listing} />
      </div>
    </GuideLayout>
  );
}
