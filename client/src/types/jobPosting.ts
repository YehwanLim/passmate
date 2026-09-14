// 채용공고 맞춤 분석 — 서버(lib/job-posting.js)가 정리한 공고 요약과 그 레코드.
// GET /api/analysis/:id 의 job_posting 과 분석 폼이 같은 형태를 쓴다.

export interface JobPostingSummary {
  /** 공고 제목. 비어 있을 수 있다 */
  title: string;
  /** 비어 있을 수 있다 */
  company: string;
  /** 비어 있을 수 있다 */
  role: string;
  responsibilities: string[];
  requirements: string[];
  preferred: string[];
  keywords: string[];
}

export interface JobPostingRecord {
  id: string;
  sourceUrl: string | null;
  summary: JobPostingSummary;
  charCount?: number;
}
