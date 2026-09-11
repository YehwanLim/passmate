/**
 * PassMate — GA4 Analytics 유틸리티
 *
 * - Production 환경에서만 실제 이벤트를 전송합니다.
 * - 개발/테스트 환경에서는 console.debug로 로그만 출력합니다.
 * - VITE_GA_MEASUREMENT_ID 환경변수가 없으면 조용히 스킵합니다.
 */

// ──────────────────────────────────────────────────────────────
// 타입 선언
// ──────────────────────────────────────────────────────────────

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// ──────────────────────────────────────────────────────────────
// 내부 상수 & 헬퍼
// ──────────────────────────────────────────────────────────────

const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const IS_PROD = import.meta.env.PROD as boolean;

/**
 * GA4 이벤트 전송 내부 헬퍼.
 * - Production이고 GA_ID가 존재하고 window.gtag가 로드된 경우에만 전송.
 * - 개발 환경에서는 console.debug로 이벤트 내용을 출력.
 */
function sendEvent(eventName: string, params?: Record<string, unknown>): void {
  if (!IS_PROD || !GA_ID) {
    // 개발 환경: 콘솔에 이벤트 미리보기 (console.log — Chrome 기본 필터에서 보임)
    console.log(`[GA4 Dev] ${eventName}`, params ?? {});
    return;
  }

  if (typeof window.gtag !== "function") {
    console.warn("[GA4] window.gtag is not loaded yet.");
    return;
  }

  window.gtag("event", eventName, params ?? {});
}

// ──────────────────────────────────────────────────────────────
// 공개 이벤트 함수
// ──────────────────────────────────────────────────────────────

/**
 * 신규 회원가입 완료 시 호출
 * GA4 이벤트: sign_up
 */
export function trackSignUp(method: string = "google"): void {
  sendEvent("sign_up", { method });
}

/**
 * 로그인 성공 시 호출
 * GA4 이벤트: login
 */
export function trackLogin(method: string = "google"): void {
  sendEvent("login", { method });
}

/**
 * 자소서 입력 완료(제출) 시 호출
 * GA4 이벤트: resume_upload
 *
 * @param fileType     입력 방식 ("text" = 직접 입력, "file" = 파일 업로드)
 * @param resumeLength 전체 글자 수
 */
export function trackResumeUpload(
  fileType: string = "text",
  resumeLength: number
): void {
  sendEvent("resume_upload", {
    file_type: fileType,
    resume_length: resumeLength,
  });
}

/**
 * AI 분석 시작 버튼 클릭 시 호출
 * GA4 이벤트: analysis_start
 *
 * @param analysisType  분석 유형 (예: "cover_letter")
 * @param resumeLength  전체 글자 수
 */
export function trackAnalysisStart(
  analysisType: string = "cover_letter",
  resumeLength: number
): void {
  sendEvent("analysis_start", {
    analysis_type: analysisType,
    resume_length: resumeLength,
  });
}

/**
 * AI 분석 성공 완료 시 호출
 * GA4 이벤트: analysis_complete
 *
 * @param analysisType  분석 유형 (예: "cover_letter")
 * @param durationMs    분석 소요 시간 (ms)
 */
export function trackAnalysisComplete(
  analysisType: string = "cover_letter",
  durationMs: number
): void {
  sendEvent("analysis_complete", {
    analysis_type: analysisType,
    duration_ms: durationMs,
    success: true,
  });
}

/**
 * AI 분석 실패 시 호출
 * GA4 이벤트: analysis_failed
 *
 * @param analysisType  분석 유형 (예: "cover_letter")
 * @param errorType     에러 유형 ("timeout" | "rate_limit" | "parse_error" | "server_error" | "fallback_detected" | "analysis_concurrency_limited")
 */
export function trackAnalysisFailed(
  analysisType: string = "cover_letter",
  errorType: string
): void {
  sendEvent("analysis_failed", {
    analysis_type: analysisType,
    error_type: errorType,
    success: false,
  });
}

/**
 * SPA 라우트 전환 시 호출 (첫 로드는 main.tsx 의 gtag config 가 이미 보낸다)
 * GA4 이벤트: page_view
 *
 * @param path  이동한 경로 (쿼리 제외 — VisitTracker 가 pathname 만 넘긴다)
 */
export function trackPageView(path: string): void {
  sendEvent("page_view", {
    page_path: path,
    page_location: `${window.location.origin}${path}`,
    page_title: document.title,
  });
}

/**
 * 로그인 없이 쓰던 화면에서 로그인 모달을 띄울 때 호출 (예: 분석 폼 제출)
 * GA4 이벤트: login_prompt — 이후 login/sign_up 과 비교해 모달 전환율을 본다
 *
 * @param context  어디서 띄웠는지 (예: "analyze_submit")
 */
export function trackLoginPrompt(context: string): void {
  sendEvent("login_prompt", { context });
}
