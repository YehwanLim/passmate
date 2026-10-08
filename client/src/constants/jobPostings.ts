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
    slug: "cj-2026h2",
    company: "CJ그룹",
    shortName: "CJ그룹",
    title: "CJ그룹 2026 하반기 신입 공채",
    subtitle: "CJ제일제당·CJ대한통운·CJ올리브영 등 13개 계열사",
    opensAt: "2026-09-16",
    closesAt: "2026-09-30T17:00:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "db-2026h2",
    company: "DB그룹",
    shortName: "DB그룹",
    title: "DB그룹 2026 하반기 신입 공채",
    subtitle: "DB손해보험·DB하이텍·DB증권 등 8개사",
    opensAt: "2026-09-01",
    closesAt: "2026-10-02T17:00:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "kyobo-securities-2026h2",
    company: "교보증권",
    shortName: "교보증권",
    title: "교보증권 2026 하반기 신입사원(5급) 공채",
    subtitle: "본사영업·본사지원·지점영업(채용연계형 인턴)",
    opensAt: "2026-09-21",
    closesAt: "2026-10-05T23:59:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "hanwha-techlife-2026",
    company: "한화그룹",
    shortName: "한화 테크&라이프",
    title: "한화그룹 테크&라이프 부문 2026 신입 공채",
    subtitle: "한화비전·한화갤러리아·아워홈 등 7개사",
    opensAt: "2026-09-21",
    closesAt: "2026-10-11T23:59:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "hansol-2026h2",
    company: "한솔그룹",
    shortName: "한솔그룹",
    title: "한솔그룹 2026 하반기 신입사원 공채",
    subtitle: "한솔제지·한솔로지스틱스·한솔PNS 등 5개사",
    opensAt: "2026-09-21",
    closesAt: "2026-10-11T23:59:00+09:00",
    updated: "2026-10-09",
  },
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
  {
    slug: "isu-2026h2",
    company: "이수그룹",
    shortName: "이수그룹",
    title: "이수그룹 2026 하반기 신입사원 공채",
    subtitle: "이수페타시스·이수화학 등 6개사",
    opensAt: "2026-09-22",
    closesAt: "2026-10-13T10:00:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "skb-junior-talent-2026",
    company: "SK브로드밴드",
    shortName: "SK브로드밴드",
    title: "SK브로드밴드 2026 Junior Talent 신입 채용",
    subtitle: "마케팅/성과관리·Infra·AT/DT·Staff 4개 직군",
    opensAt: "2026-09-30",
    closesAt: "2026-10-13T23:59:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "soil-2026",
    company: "S-OIL",
    shortName: "S-OIL",
    title: "S-OIL 2026 사무직 신입사원 채용",
    subtitle: "서울 본사 경영·영업·재무, 울산 공장 공정·설비·안전환경",
    opensAt: "2026-09-30",
    closesAt: "2026-10-14T23:59:00+09:00",
    updated: "2026-10-09",
  },
  {
    slug: "kis-fy2026",
    company: "한국투자증권",
    shortName: "한국투자증권",
    title: "한국투자증권 FY2026 신입사원(5급) 공채",
    subtitle: "PB·IB·운용·리서치·경영관리·IT/Digital 등 전 부문",
    opensAt: "2026-09-15",
    closesAt: "2026-10-19T17:00:00+09:00",
    updated: "2026-10-09",
  },
];

export function jobPostingPath(posting: Pick<JobPostingListing, "slug">): string {
  return `${JOBS_INDEX_PATH}/${posting.slug}`;
}

export function findJobPosting(slug: string | null | undefined): JobPostingListing | undefined {
  return slug ? JOB_POSTINGS.find(posting => posting.slug === slug) : undefined;
}
