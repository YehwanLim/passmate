import { JOB_POSTINGS, type JobPostingListing } from "@/constants/jobPostings";
import { JOB_POSTING_DETAILS, type JobPostingDetail } from "@/constants/jobPostingDetails";

/** "(주)삼성전자", "삼성 전자" → "삼성전자". 법인 표기·공백·대소문자만 걷어낸다. 그룹·계열사 이름은 서로 바꿔 읽지 않는다. */
export function normalizeCompanyName(name: string): string {
  return name.replace(/\(주\)|㈜|주식회사/g, "").replace(/\s+/g, "").toLowerCase();
}

/**
 * 기업 분석 리포트의 '전형 안내'에 붙일 저장 공고. 회사 칸 이름이 공고의 회사 이름·짧은 이름과 정확히 같을 때만 고른다
 * (CJ제일제당 → CJ그룹처럼 추측해서 잇지 않는다). 여러 건이면 마감이 가장 늦은 공고, 전형 절차가 없는 공고는 뺀다.
 */
export function findCompanyJobPosting(company: string): { listing: JobPostingListing; detail: JobPostingDetail } | null {
  const target = normalizeCompanyName(company);
  if (target.length === 0) return null;
  let best: { listing: JobPostingListing; detail: JobPostingDetail } | null = null;
  for (const listing of JOB_POSTINGS) {
    const detail = JOB_POSTING_DETAILS[listing.slug];
    if (!detail || detail.process.length === 0) continue;
    const names = [listing.company, listing.shortName].map(normalizeCompanyName);
    if (!names.includes(target)) continue;
    if (!best || new Date(listing.closesAt).getTime() > new Date(best.listing.closesAt).getTime()) {
      best = { listing, detail };
    }
  }
  return best;
}
