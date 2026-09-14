import type { JobPostingRecord } from "@/types/jobPosting";

// 공개 자소서 샘플 리포트(/report-new?sample=1)의 대상. 랜딩 버튼 라벨이 이 값만 쓰도록 본문(resumeReportSample.ts)과 나눈다.
// 본문을 랜딩에서 import 하면 수십 KB 가 첫 번들에 실린다(companyReportSampleMeta.ts 와 같은 이유).
// 가상의 지원자다. 랜딩 쇼케이스(report-showcase/reportShowcaseSampleData.ts)와 같은 인물·서사를 쓴다.
export const RESUME_REPORT_SAMPLE_COMPANY = "현대자동차";
export const RESUME_REPORT_SAMPLE_JOB_ROLE = "서비스 기획";
export const RESUME_REPORT_SAMPLE_DISPLAY_NAME = "김민지";
export const RESUME_REPORT_SAMPLE_PATH = "/report-new?sample=1";

// 샘플이 붙인 가상의 채용공고. 공고 적합도 섹션(PostingFitSection)의 부제와 fixture 의 postingFit 이 이 요약을 기준으로 쓴다.
export const RESUME_REPORT_SAMPLE_JOB_POSTING: JobPostingRecord = {
  id: "sample-job-posting",
  sourceUrl: null,
  summary: {
    title: "커넥티드카 서비스 기획 신입 채용",
    company: RESUME_REPORT_SAMPLE_COMPANY,
    role: RESUME_REPORT_SAMPLE_JOB_ROLE,
    responsibilities: [
      "커넥티드카 앱 서비스 기획 및 고객 여정 설계",
      "서비스 지표 정의와 데이터 기반 개선 과제 발굴",
      "개발·디자인·사업 부서와의 요구사항 조율",
    ],
    requirements: [
      "데이터를 활용해 서비스 문제를 정의하고 개선한 경험",
      "여러 이해관계자와 협업해 요구사항을 합의한 경험",
      "모바일 앱 서비스 기획 또는 운영 경험",
      "커넥티드카·모빌리티 서비스에 대한 이해",
    ],
    preferred: ["SQL 등 데이터 분석 도구 활용 가능자", "A/B 테스트 설계 및 운영 경험", "글로벌 서비스 기획 경험"],
    keywords: ["커넥티드카", "고객 여정", "데이터 기반 의사결정", "이해관계자 협업", "SQL", "A/B 테스트", "글로벌"],
  },
};
