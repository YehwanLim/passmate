// 공개 자소서 샘플 리포트(/report-new?sample=1)의 대상. 랜딩 버튼 라벨이 이 값만 쓰도록 본문(resumeReportSample.ts)과 나눈다.
// 본문을 랜딩에서 import 하면 수십 KB 가 첫 번들에 실린다(companyReportSampleMeta.ts 와 같은 이유).
// 가상의 지원자다. 랜딩 쇼케이스(report-showcase/reportShowcaseSampleData.ts)와 같은 인물·서사를 쓴다.
export const RESUME_REPORT_SAMPLE_COMPANY = "현대자동차";
export const RESUME_REPORT_SAMPLE_JOB_ROLE = "서비스 기획";
export const RESUME_REPORT_SAMPLE_DISPLAY_NAME = "김민지";
export const RESUME_REPORT_SAMPLE_PATH = "/report-new?sample=1";
