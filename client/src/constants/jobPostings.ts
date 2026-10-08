import { JOBS_INDEX_PATH } from "@/lib/seo";

/**
 * 채용 공고 목록(/jobs)·홈 '지금 접수 중' 한 줄·분석 폼 '접수 중인 공고' 탭이 함께 쓰는 최소 필드.
 * 홈 번들에 실리므로 본문(문항·쓰는 법)은 constants/jobPostingDetails.ts 에 따로 둔다 — 홈에서 import 하지 않는다.
 *
 * 내용은 네이버 블로그 공고 글을 쓰며 공식 채용 페이지(1차)로 확인한 것만 옮긴다(.agents/blog-job-posts/drafts).
 * 다른 취업 사이트 공고를 긁어 오지 않는다. 공고를 더하면 두 파일에 같은 slug 로 한 건씩 넣는다(jobPostings.test.ts 가 검사).
 * 설계: docs/superpowers/specs/2026-10-09-채용-공고-노출.md
 */
export type JobPostingListing = {
  /** 주소 /jobs/<slug>. 영문 소문자·숫자·하이픈 */
  slug: string;
  /** 분석 폼·지원서의 회사 칸에 채울 이름 */
  company: string;
  /** 홈 한 줄처럼 좁은 자리에 쓰는 짧은 이름 */
  shortName: string;
  title: string;
  /** 계열사·직군 한 줄 */
  subtitle: string;
  /** 접수 시작일(YYYY-MM-DD) */
  opensAt: string;
  /** 접수 마감(한국 시각, "+09:00" ISO) */
  closesAt: string;
  /** 페이지 내용을 고친 날(sitemap lastmod) */
  updated: string;
};

export const JOB_POSTINGS: readonly JobPostingListing[] = [
  {
    slug: "shinsegae-2027",
    company: "신세계그룹",
    shortName: "신세계그룹",
    title: "신세계그룹 2027 신입사원 공채",
    subtitle: "이마트·신세계백화점·스타벅스 등 10개사",
    opensAt: "2026-09-18",
    closesAt: "2026-10-12T18:00:00+09:00",
    updated: "2026-10-09",
  },
];

export function jobPostingPath(posting: Pick<JobPostingListing, "slug">): string {
  return `${JOBS_INDEX_PATH}/${posting.slug}`;
}

export function findJobPosting(slug: string | null | undefined): JobPostingListing | undefined {
  return slug ? JOB_POSTINGS.find(posting => posting.slug === slug) : undefined;
}
