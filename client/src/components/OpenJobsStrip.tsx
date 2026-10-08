import { Link } from "wouter";
import { jobPostingPath, JOB_POSTINGS } from "@/constants/jobPostings";
import { useNow } from "@/hooks/useNow";
import { dDayLabel, openPostings } from "@/lib/jobPostingDates";
import { JOBS_INDEX_PATH } from "@/lib/seo";

const MAX_ITEMS = 6;

/**
 * 홈 기업 로고 띠 바로 아래 '지금 접수 중' 한 줄(10-09 시안 A: 흰 로고 판과 다른 한 톤 진한 회색 판).
 * 접수 중 여부는 시각에 달려 있어 브라우저가 시각을 알기 전(프리렌더·하이드레이션 첫 패스)과 접수 중 공고가 없을 땐 그리지 않는다.
 * 홈 번들에 실리므로 constants/jobPostingDetails.ts(본문)는 import 하지 않는다.
 */
export default function OpenJobsStrip() {
  const now = useNow();
  const open = now ? openPostings(JOB_POSTINGS, now).slice(0, MAX_ITEMS) : [];
  if (!now || open.length === 0) return null;

  return (
    <div className="mx-auto mt-4 flex max-w-7xl items-center gap-4 rounded-[20px] bg-[#eceef1] px-5 py-3.5 text-[14px] md:gap-5 md:px-6">
      <span className="shrink-0 font-bold text-ink">지금 접수 중</span>
      <ul className="flex min-w-0 flex-1 items-center gap-x-4 overflow-x-auto whitespace-nowrap text-ink-2 [scrollbar-width:none]">
        {open.map((posting, index) => (
          <li key={posting.slug} className="flex items-center gap-4">
            {index > 0 && (
              <span className="text-ink-5" aria-hidden="true">
                ·
              </span>
            )}
            <Link href={jobPostingPath(posting)} className="transition-colors hover:text-ink">
              {posting.shortName} <b className="ml-0.5 font-bold text-danger">{dDayLabel(posting.closesAt, now)}</b>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={JOBS_INDEX_PATH} className="shrink-0 font-semibold text-brand-ink hover:text-brand">
        <span className="hidden sm:inline">공고 </span>전체 보기 →
      </Link>
    </div>
  );
}
