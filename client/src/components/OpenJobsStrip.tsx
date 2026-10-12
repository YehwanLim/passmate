import { Link } from "wouter";
import { jobPostingPath, JOB_POSTINGS } from "@/constants/jobPostings";
import { useNow } from "@/hooks/useNow";
import { dDayLabel, openPostings } from "@/lib/jobPostingDates";
import { JOBS_INDEX_PATH } from "@/lib/seo";

/**
 * 홈 기업 로고 띠 바로 아래 '지금 접수 중' 한 줄(10-09 시안 A: 흰 로고 판과 다른 한 톤 진한 회색 판).
 * 회사 이름·D-n 을 줄줄이 늘어놓으면 시세판처럼 복잡해 보여(10-09), 몇 곳이 접수 중인지와 가장 빠른 마감 한 곳만 한 문장으로 쓴다.
 * 접수 중 여부는 시각에 달려 있어 브라우저가 시각을 알기 전(프리렌더·하이드레이션 첫 패스)과 접수 중 공고가 없을 땐 그리지 않는다.
 * 홈 번들에 실리므로 constants/jobPostingDetails.ts(본문)는 import 하지 않는다.
 */
export default function OpenJobsStrip() {
  const now = useNow();
  const open = now ? openPostings(JOB_POSTINGS, now) : [];
  if (!now || open.length === 0) return null;

  const companyCount = new Set(open.map(posting => posting.shortName)).size;
  const soonest = open[0];

  return (
    <div className="mx-auto mt-4 flex w-fit max-w-full items-center justify-center gap-4 rounded-[20px] bg-[#eceef1] px-5 py-3.5 text-[14px] md:gap-8 md:px-7">
      <p className="min-w-0 text-ink">
        지금 <b className="font-bold">{companyCount}개 기업</b>이 접수 중이에요
        <span className="mx-2 text-ink-5 max-sm:hidden" aria-hidden="true">
          ·
        </span>
        <span className="text-ink-3 max-sm:mt-0.5 max-sm:block">
          가장 빠른 마감은{" "}
          <Link href={jobPostingPath(soonest)} className="text-ink-2 transition-colors hover:text-ink">
            {soonest.shortName} <b className="ml-0.5 font-bold text-danger">{dDayLabel(soonest.closesAt, now)}</b>
          </Link>
        </span>
      </p>
      <Link href={JOBS_INDEX_PATH} className="shrink-0 font-semibold text-brand-ink hover:text-brand">
        공고 보기 →
      </Link>
    </div>
  );
}
