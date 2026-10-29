import { useState } from "react";
import { Search } from "lucide-react";
import { Link } from "wouter";
import { GuideLayout } from "@/components/guide/GuideLayout";
import { jobPostingPath, JOB_POSTINGS, type JobPostingListing } from "@/constants/jobPostings";
import { useNow } from "@/hooks/useNow";
import { closedPostings, dDayLabel, formatDeadline, openPostings } from "@/lib/jobPostingDates";

// 폰: 왼쪽 로고 칸 + 오른쪽에 마감·공고·직무를 쌓는다. md 이상: 로고 | 마감 | 공고 | 모집 직무 | 자세히.
const ROW_GRID =
  "grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[76px_170px_minmax(0,1.3fr)_minmax(0,1fr)_72px] md:items-center md:gap-6";
/** 폰에선 로고 칸 오른쪽(둘째 열)에 쌓이고, md 이상에선 자기 열에 놓인다. */
const RIGHT_OF_LOGO = "col-start-2 md:col-start-auto";

/** 줄 맨 왼쪽 회사 로고. 칸·테두리 없이 로고만(10-11 시안 B). 로고 파일이 없는 공고는 회사 이름 첫 글자. */
function CompanyLogo({ posting }: { posting: JobPostingListing }) {
  return (
    <span
      aria-hidden="true"
      className="row-span-3 flex h-10 w-16 items-center justify-center self-center md:row-span-1 md:h-11 md:w-[76px]"
    >
      {posting.logo ? (
        // 흰 바탕 JPG 로고(SPC·산은캐피탈)가 hover 회색 바탕에서 흰 네모로 뜨지 않게 multiply
        <img src={posting.logo} alt="" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain mix-blend-multiply" />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-full bg-fill-soft text-[16px] font-bold text-ink-4">
          {posting.company.charAt(0)}
        </span>
      )}
    </span>
  );
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
        <span />
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
              className={`grid gap-x-4 gap-y-1.5 px-5 py-5 transition-colors hover:bg-fill-soft md:px-7 ${ROW_GRID}`}
            >
              <CompanyLogo posting={posting} />
              <span className={`text-[14px] tabular-nums text-ink-3 ${RIGHT_OF_LOGO}`}>
                {now && !closed && <b className="mr-1.5 text-[15px] font-bold text-danger">{dDayLabel(posting.closesAt, now)}</b>}
                {closed && <span className="mr-1.5 text-ink-4">마감</span>}
                {formatDeadline(posting.closesAt)}
              </span>
              {/* 계열사 한 줄(subtitle)은 목록에서 뺐다(10-11). 검색은 여전히 subtitle 도 본다 */}
              <span className={`min-w-0 text-[16px] font-semibold leading-snug text-ink [word-break:keep-all] ${RIGHT_OF_LOGO}`}>
                {posting.title}
              </span>
              <span className={`text-[14px] leading-relaxed text-ink-3 [word-break:keep-all] ${RIGHT_OF_LOGO}`}>{posting.roles}</span>
              <span className="hidden text-right text-[14px] font-semibold text-brand-ink md:block">자세히 →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 띄어쓰기·대소문자를 무시하고 회사·공고명·계열사·직무에서 찾는다("sk 바이오" → SK바이오사이언스). */
function matchesQuery(posting: JobPostingListing, query: string): boolean {
  const normalize = (text: string) => text.replace(/\s+/g, "").toLowerCase();
  const needle = normalize(query);
  if (!needle) return true;
  return [posting.company, posting.shortName, posting.title, posting.subtitle, posting.roles].some(field =>
    normalize(field).includes(needle),
  );
}

/**
 * /jobs — 채용 공고 목록. 접수 중(마감 가까운 순) 아래에 마감된 공고(최근 마감 순)를 둔다.
 * 접수 중/마감 구분은 시각에 달려 있어 useNow() 가 있을 때만 나눈다. 프리렌더 HTML 은 전체를 마감 순으로 한 표에 담는다.
 * 메타는 lib/seo.ts 의 "/jobs" 항목을 RouteMeta 가 적용한다.
 */
export default function JobsIndex() {
  const now = useNow();
  const [query, setQuery] = useState("");
  const postings = JOB_POSTINGS.filter(posting => matchesQuery(posting, query));
  const open = now ? openPostings(postings, now) : null;
  const closed = now ? closedPostings(postings, now) : [];
  const searching = query.trim().length > 0;

  return (
    <GuideLayout>
      {/* 머리말 없이 작은 제목 하나 — 바로 목록이 보이게(10-09). 오른쪽 위에 회사·직무 찾기(10-09) */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] text-ink">채용 공고</h1>
        <label className="flex h-[42px] items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:border-brand sm:w-[300px]">
          <Search className="size-4 shrink-0 text-ink-5" aria-hidden="true" />
          <input
            type="search"
            aria-label="회사나 직무로 찾기"
            placeholder="회사나 직무로 찾기"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-5 focus:outline-none"
          />
        </label>
      </div>

      {open === null ? (
        // JOB_POSTINGS 는 마감 순으로 적어 둔다(jobPostings.test.ts).
        <PostingTable postings={postings} now={null} />
      ) : open.length > 0 ? (
        <PostingTable postings={open} now={now} />
      ) : (
        <p className="rounded-[24px] bg-surface px-7 py-8 text-[15px] text-ink-3">
          {searching
            ? closed.length > 0
              ? `'${query.trim()}'에 맞는 공고는 이미 마감됐어요. 아래 마감된 공고에서 볼 수 있어요.`
              : `'${query.trim()}'에 맞는 공고가 없어요. 회사 이름이나 직무를 다르게 적어 보세요.`
            : "지금 접수 중인 공고가 없어요. 새 공고가 열리면 여기에 올려요."}
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
