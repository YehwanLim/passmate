import { getAnalyzeErrorMessage, getAnalyzeErrorTitle } from "./Analyze";

export interface CompanyAnalyzeErrorView {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  /** analytics trackAnalysisFailed 의 error_type */
  trackingType: string;
}

function errorCodeOf(errorData: unknown): string | null {
  if (errorData && typeof errorData === "object" && typeof (errorData as { error?: unknown }).error === "string") {
    return (errorData as { error: string }).error;
  }
  return null;
}

/**
 * POST /api/analyze/company 실패 응답을 모달 문구로 바꾼다.
 * 기업 분석 전용 코드만 여기서 다루고, 나머지는 자소서 분석과 같은 문구(Analyze.tsx)를 쓴다.
 * 서버 원문(message)은 절대 그대로 보여주지 않는다.
 */
export function getCompanyAnalyzeError(errorData: unknown, status: number): CompanyAnalyzeErrorView {
  const code = errorCodeOf(errorData);
  if (code === "COMPANY_CREDITS_EXHAUSTED") {
    return {
      title: "이용권 없음",
      message: "기업 분석 이용권이 없어요. 이용권 페이지에서 기업 분석 1회 또는 스탠다드·프리미엄을 구매할 수 있어요.",
      actionLabel: "이용권 확인하기",
      actionHref: "/entitlements#company",
      trackingType: "credits_exhausted",
    };
  }
  if (code === "COMPANY_ANALYSIS_DISABLED") {
    return {
      title: "준비 중",
      message: "기업 분석 리포트는 아직 준비 중이에요. 열리면 알려 드릴게요.",
      trackingType: "disabled",
    };
  }
  if (code === "RESUME_ANALYSIS_NOT_FOUND") {
    return {
      title: "연결 오류",
      message: "연결하려는 자소서 분석을 찾을 수 없어요. 연결을 해제하고 다시 시도해 주세요.",
      trackingType: "resume_not_found",
    };
  }

  const title = getAnalyzeErrorTitle(errorData, status);
  const trackingType = title === "요청 제한"
    ? "rate_limit"
    : code === "CONTEXT_IRRELEVANT"
      ? "context_irrelevant"
      : code === "ANALYSIS_CONCURRENCY_LIMITED"
        ? "analysis_concurrency_limited"
        : "server_error";
  return {
    title: code === "CONTEXT_IRRELEVANT" ? "기업 확인 필요" : title,
    message: code === "CONTEXT_IRRELEVANT"
      ? "입력한 기업을 공개 자료에서 확인하지 못했어요. 정확한 회사명으로 다시 시도해 주세요."
      : getAnalyzeErrorMessage(errorData),
    trackingType,
  };
}
