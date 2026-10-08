import { Link } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { jobPostingPath, JOB_POSTINGS, type JobPostingListing } from "@/constants/jobPostings";
import { useNow } from "@/hooks/useNow";
import { closedPostings, dDayLabel, formatDeadline, openPostings } from "@/lib/jobPostingDates";

const ROW_GRID = "md:grid-cols-[150px_minmax(0,1.1fr)_minmax(0,1fr)_72px] md:items-center md:gap-6";

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
        <span>모집 직무</span>
        <span />
      </div>
      <ul className="divide-y divide-line-soft">
        {postings.map(posting => (
          <li key={posting.slug}>
            <Link
              href={jobPostingPath(posting)}
              className={`grid gap-1.5 px-5 py-5 transition-colors hover:bg-fill-soft md:px-7 ${ROW_GRID}`}
            >
              {/* 마감까지 남은 날이 먼저 눈에 들어오게 D-n 을 크게, 날짜는 그 아래 작게 */}
              <span className="flex items-baseline gap-2 tabular-nums md:flex-col md:gap-1">
                {now && !closed && (
                  <b className="text-[22px] font-extrabold leading-none tracking-[-0.02em] text-danger">
                    {dDayLabel(posting.closesAt, now)}
                  </b>
                )}
                {closed && <span className="text-[16px] font-bold leading-none text-ink-4">마감</span>}
                <span className="text-[13px] text-ink-4">{formatDeadline(posting.closesAt)}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-bold leading-snug text-ink [word-break:keep-all]">{posting.title}</span>
                <span className="mt-0.5 block text-[14px] text-ink-4 [word-break:keep-all]">{posting.subtitle}</span>
              </span>
              <span className="text-[14px] leading-relaxed text-ink-3 [word-break:keep-all]">{posting.roles}</span>
              <span className="hidden text-right text-[14px] font-semibold text-brand-ink md:block">자세히 →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * /jobs — 채용 공고 목록. 접수 중(마감 가까운 순) 아래에 마감된 공고(최근 마감 순)를 둔다.
 * 접수 중/마감 구분은 시각에 달려 있어 useNow() 가 있을 때만 나눈다. 프리렌더 HTML 은 전체를 마감 순으로 한 표에 담는다.
 * 메타는 lib/seo.ts 의 "/jobs" 항목을 RouteMeta 가 적용한다.
 */
export default function JobsIndex() {
  const now = useNow();
  const open = now ? openPostings(JOB_POSTINGS, now) : null;
  const closed = now ? closedPostings(JOB_POSTINGS, now) : [];

  return (
    <GuideLayout>
      {/* 머리말 없이 작은 제목 하나 — 바로 목록이 보이게(10-09) */}
      <h1 className="mb-5 text-[22px] font-bold tracking-[-0.02em] text-ink">채용 공고</h1>

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
          <h2 id="closed-jobs" className="mb-5 text-[18px] font-bold tracking-[-0.02em] text-ink">
            마감된 공고
          </h2>
          <PostingTable postings={closed} now={now} closed />
        </section>
      )}
    </GuideLayout>
  );
}
