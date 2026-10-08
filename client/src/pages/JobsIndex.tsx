import { Link } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { jobPostingPath, JOB_POSTINGS, type JobPostingListing } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS } from "@/constants/jobPostingDetails";
import { useNow } from "@/hooks/useNow";
import { closedPostings, dDayLabel, formatDeadline, openPostings } from "@/lib/jobPostingDates";

// 화면 머리말. 검색 설명(lib/seo.ts JOBS_INDEX_DESCRIPTION)과는 따로 둔다.
const INTRO = "공식 채용 페이지에서 직접 확인한 공고만 모았어요. 마감 가까운 순이에요.";
const ROW_GRID = "md:grid-cols-[180px_minmax(0,1fr)_170px_72px] md:items-center md:gap-6";

function questionsLabel(posting: JobPostingListing): string {
  const count = JOB_POSTING_DETAILS[posting.slug]?.questions.length ?? 0;
  return count > 0 ? `${count}문항` : "지원서 화면에서 공개";
}

/** 공고 표. now 가 없으면(프리렌더·하이드레이션 첫 화면) D-n 없이 날짜만 보인다. */
function PostingTable({
  postings,
  now,
  closed = false,
}: {
  postings: readonly JobPostingListing[];
  now: Date | null;
  closed?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] bg-surface">
      <div className={`hidden border-b border-line bg-fill-soft px-7 py-3 text-[13px] font-semibold text-ink-4 md:grid ${ROW_GRID}`}>
        <span>마감</span>
        <span>공고</span>
        <span>자소서 문항</span>
        <span />
      </div>
      <ul className="divide-y divide-line-soft">
        {postings.map(posting => (
          <li key={posting.slug}>
            <Link
              href={jobPostingPath(posting)}
              className={`grid gap-1.5 px-5 py-5 transition-colors hover:bg-fill-soft md:px-7 ${ROW_GRID}`}
            >
              <span className="text-[14px] tabular-nums text-ink-3">
                {now && !closed && <b className="mr-1.5 font-bold text-danger">{dDayLabel(posting.closesAt, now)}</b>}
                {closed && <span className="mr-1.5 text-ink-4">마감</span>}
                {formatDeadline(posting.closesAt)}
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold leading-snug text-ink [word-break:keep-all]">{posting.title}</span>
                <span className="mt-0.5 block text-[14px] text-ink-4 [word-break:keep-all]">{posting.subtitle}</span>
              </span>
              <span className="text-[14px] text-ink-4">{questionsLabel(posting)}</span>
              <span className="hidden text-right text-[14px] font-semibold text-brand-ink md:block">자세히 →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * /jobs — 채용 공고 목록. 접수 중(마감 가까운 순) 아래에 마감된 공고(최근 마감 순, 지난 문항 참고용)를 둔다.
 * 접수 중/마감 구분은 시각에 달려 있어 useNow() 가 있을 때만 나눈다. 프리렌더 HTML 은 전체를 마감 순으로 한 표에 담는다.
 * 메타는 lib/seo.ts 의 "/jobs" 항목을 RouteMeta 가 적용한다.
 */
export default function JobsIndex() {
  const now = useNow();
  const open = now ? openPostings(JOB_POSTINGS, now) : null;
  const closed = now ? closedPostings(JOB_POSTINGS, now) : [];

  return (
    <GuideLayout>
      <div className="mb-10 flex max-w-2xl flex-col gap-3">
        <p className="text-[14px] font-semibold text-brand-ink">채용 공고</p>
        <h1 className="text-[32px] font-extrabold leading-[1.2] tracking-[-0.035em] text-ink [word-break:keep-all] md:text-[44px]">
          지금 접수 중인 대기업 신입 공고
        </h1>
        <p className="text-[15px] leading-7 text-ink-3 md:text-[16px]">{INTRO}</p>
      </div>

      {open === null ? (
        // JOB_POSTINGS 는 마감 순으로 적어 둔다(jobPostings.test.ts).
        <PostingTable postings={JOB_POSTINGS} now={null} />
      ) : open.length > 0 ? (
        <PostingTable postings={open} now={now} />
      ) : (
        <p className="rounded-[24px] bg-surface px-7 py-8 text-[15px] text-ink-3">
          지금 접수 중인 공고가 없어요. 새 공고가 열리면 여기에 올려요.
        </p>
      )}

      {closed.length > 0 && (
        <section className="mt-14" aria-labelledby="closed-jobs">
          <h2 id="closed-jobs" className="text-[22px] font-bold tracking-[-0.02em] text-ink">
            마감된 공고
          </h2>
          <p className="mb-5 mt-1.5 text-[15px] text-ink-3">지난 문항과 쓰는 법은 다음 시즌 준비에 참고하세요.</p>
          <PostingTable postings={closed} now={now} closed />
        </section>
      )}
    </GuideLayout>
  );
}
