import { UI_LABELS } from "@/constants/labels";

/**
 * POST /api/analyze 계열 실패 응답의 error 코드를 사용자 문구로 바꾼다.
 * 서버 원문(message)은 그대로 보여주지 않는다. 자소서·기업 분석이 함께 쓴다.
 */
export function getAnalyzeErrorMessage(errorData: unknown): string {
  if (!errorData || typeof errorData !== "object") {
    return UI_LABELS.ANALYSIS_FAILED;
  }

  const { error } = errorData as { error?: unknown };
  if (error === "RATE_LIMITED") return UI_LABELS.RATE_LIMIT_ERROR;
  if (error === "CONTEXT_IRRELEVANT") return UI_LABELS.CONTEXT_IRRELEVANT;
  if (error === "ANALYSIS_DISABLED")
    return "분석 기능이 일시적으로 중단되었습니다. 잠시 후 다시 시도해 주세요.";
  if (error === "ANALYSIS_CREDITS_EXHAUSTED") {
    return "보유한 분석 이용권을 모두 사용했어요. 이용권 페이지에서 남은 횟수와 추가 이용권을 확인할 수 있어요.";
  }
  if (error === "ANALYSIS_CONCURRENCY_LIMITED") {
    return "진행 중인 분석이 끝난 뒤 다시 시도해 주세요.";
  }
  if (
    error === "ANALYSIS_PERSISTENCE_PENDING" ||
    error === "ANALYSIS_IN_PROGRESS"
  ) {
    return "분석 결과를 안전하게 저장하고 있어요. 잠시 후 같은 내용으로 다시 시도해 주세요.";
  }
  if (
    error === "ANALYSIS_RETRY_WITH_NEW_KEY" ||
    error === "INVALID_IDEMPOTENCY_KEY"
  ) {
    return "이전 요청 정보가 만료되었어요. 분석 시작을 한 번 더 눌러 주세요.";
  }
  if (error === "IDEMPOTENCY_KEY_REUSED") {
    return "같은 요청이 이미 접수되어 있어요. 내용을 수정했다면 잠시 후 다시 시도해 주세요.";
  }
  if (error === "AUTHENTICATION_REQUIRED")
    return "로그인 후 분석을 시작할 수 있어요.";
  return UI_LABELS.ANALYSIS_FAILED;
}

export function getAnalyzeErrorTitle(
  errorData: unknown,
  status?: number
): string {
  const { error } =
    errorData && typeof errorData === "object"
      ? (errorData as { error?: unknown })
      : {};

  if (status === 429 || error === "RATE_LIMITED") return "요청 제한";
  if (error === "ANALYSIS_CONCURRENCY_LIMITED") return "분석 진행 중";
  return "분석 실패";
}
