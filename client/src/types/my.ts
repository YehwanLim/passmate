// =============================================================================
// My 탭 — 타입 정의 (API 응답과 1:1 매핑)
// =============================================================================
// 모든 필드명은 API 응답의 snake_case와 동일하게 유지하여
// fetch 결과를 별도 매핑 없이 그대로 사용합니다.
// =============================================================================

/** Project 리스트에서 사용하는 요약 구조 */
export interface ProjectSummary {
  id: string;
  title: string;
  /** 지원 기업명 (DB: projects.company → API: company_name) */
  company_name: string | null;
  /** 지원 직무 (DB: projects.job_keyword → API: job_role) */
  job_role: string | null;
  /** 생성일 ISO 8601 */
  created_at: string;
  /** 해당 프로젝트의 분석 건수 (_count.analyses) */
  analysis_count: number;
  /** 최신 analysis 기준 글자 수 (없으면 0) */
  total_chars: number | null;
  /** 최신 analysis의 ai_response_json.summary (없으면 null) */
  summary: string | null;
  /** 핵심 역량 키워드 — 현재 API 미반환, 프론트 Mock용 optional */
  // TODO: keywords 컬럼 향후 추가 시 required로 변경
  keywords?: string[];
}

/** 분석 상태 enum — DB AnalysisStatus와 동일 */
export type AnalysisStatus = "PENDING" | "SUCCESS" | "FAILED";

/** Analysis 리스트에서 사용하는 경량 구조 */
export interface AnalysisSummary {
  id: string;
  /** 문항 텍스트 (DB: analyses.question_text) */
  question_text: string;
  /** 유저가 작성한 원문 — 리스트 API에서는 미반환, 상세 진입 시 사용 */
  input_text?: string;
  /** 분석 상태 */
  status: AnalysisStatus;
  /** 생성일 ISO 8601 */
  created_at: string;
}

/** Analysis 상세에서 사용하는 전체 구조 */
export interface AnalysisDetail {
  id: string;
  question_text: string;
  /** 유저가 작성한 원문 */
  input_text: string;
  /** AI 분석 전체 응답 (score 제거됨) */
  ai_response_json: Record<string, unknown> | null;
  status: AnalysisStatus;
  total_chars: number;
  created_at: string;
}
