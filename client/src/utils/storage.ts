// =============================================================================
// localStorage 유틸리티 — 분석 결과 저장/복원/삭제
// =============================================================================
// 구조 설계:
//   "passmate_latest_analysis" → 가장 최근 분석 결과 (새로고침 복원용, 1건)
//   "passmate_draft"           → 작성 중인 자소서 초안 (입력 복원용)
//
// 확장 로드맵:
//   현재: localStorage에 최신 1건만 저장 (오프라인/비로그인 대응)
//   추후: DB 기반 My 탭에서 전체 히스토리 관리
//         → localStorage = "임시 캐시" / DB = "영구 저장소"
//         → 로그인 시 localStorage → DB 동기화 가능
// =============================================================================

/** localStorage 키 상수 */
export const STORAGE_KEYS = {
  /** 가장 최근 분석 결과 (통합 구조) */
  LATEST_ANALYSIS: "passmate_latest_analysis",
  /** 작성 중인 자소서 초안 */
  DRAFT: "passmate_draft",
  /** 익명 사용자 UUID */
  ANONYMOUS_USER_ID: "passmate_anonymous_uid",
  /** Feedback 캐시 접두사 (passmate_feedback_{analysisId}) */
  FEEDBACK_PREFIX: "passmate_feedback_",
  /** [레거시] sessionStorage 분석 결과 — 추후 제거 예정 */
  SESSION_RESULT: "passmate_analysis_result",
  SESSION_QUESTIONS: "passmate_raw_questions",
  SESSION_COMPANY: "passmate_company",
  SESSION_JOB: "passmate_job",
} as const;

// ─────────────────────────────────────────────────────────────
// SSR 안전 체크
// ─────────────────────────────────────────────────────────────

/** 브라우저 환경인지 확인 (SSR/hydration 대응) */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// ─────────────────────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────────────────────

/** 저장되는 개별 문항 구조 (DB Analysis 테이블과 매핑) */
export interface StoredQuestionItem {
  /** 문항 텍스트 (DB: question_text) */
  question_text: string;
  /** 사용자 원문 자소서 (DB: input_text) */
  input_text: string;
}

/** localStorage에 저장되는 분석 결과 통합 구조 */
export interface StoredAnalysis {
  /** AI 분석 결과 전체 JSON (DB: ai_response_json) */
  ai_response_json: Record<string, unknown>;
  /** AI 점수 (DB: ai_score, nullable) */
  ai_score: number | null;
  /** 원본 질문/답변 배열 */
  questions: StoredQuestionItem[];
  /** 지원 기업명 */
  company: string;
  /** 지원 직무 */
  jobKeyword: string;
  /** 저장 시각 (ISO 8601, DB: created_at) */
  created_at: string;
  /** 프로젝트 ID (DB 저장 시 부여, 없으면 null) */
  project_id: string | null;
  /** DB Analysis ID (Feedback 연결용, DB 저장 시 부여) */
  analysis_id?: string;
}

/** localStorage 저장 포맷 (메타데이터 래퍼) */
interface StoredAnalysisEnvelope {
  analysis: StoredAnalysis;
  savedAt: string;
}

/** 작성 중인 초안 구조 */
export interface StoredDraft {
  company: string;
  selectedJob: string | null;
  customJob: string;
  questions: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

// ─────────────────────────────────────────────────────────────
// 분석 결과 — 저장 (saveAnalysisToStorage)
// ─────────────────────────────────────────────────────────────

/**
 * 분석 결과를 localStorage에 저장
 * - 기존 데이터 overwrite 방식 (최신 1건만 유지)
 * - sessionStorage에도 동시 저장 (현재 세션 내 페이지 이동용, 레거시 호환)
 */
export function saveAnalysisToStorage(params: {
  result: Record<string, unknown>;
  questions: Array<{ question: string; answer: string }>;
  company: string;
  jobKeyword: string;
  aiScore?: number | null;
  projectId?: string;
}): void {
  if (!isBrowser()) return;

  const analysis: StoredAnalysis = {
    ai_response_json: params.result,
    ai_score: params.aiScore ?? null,
    questions: params.questions.map((q) => ({
      question_text: q.question,
      input_text: q.answer,
    })),
    company: params.company,
    jobKeyword: params.jobKeyword,
    created_at: new Date().toISOString(),
    project_id: params.projectId ?? null,
  };

  const envelope: StoredAnalysisEnvelope = {
    analysis,
    savedAt: new Date().toISOString(),
  };

  try {
    const json = JSON.stringify(envelope);
    localStorage.setItem(STORAGE_KEYS.LATEST_ANALYSIS, json);

    // sessionStorage에도 저장 (레거시 호환 — ReportResult에서 사용)
    sessionStorage.setItem(STORAGE_KEYS.SESSION_RESULT, JSON.stringify(params.result));
    sessionStorage.setItem(
      STORAGE_KEYS.SESSION_QUESTIONS,
      JSON.stringify(params.questions)
    );
    sessionStorage.setItem(STORAGE_KEYS.SESSION_COMPANY, params.company);
    sessionStorage.setItem(STORAGE_KEYS.SESSION_JOB, params.jobKeyword);
  } catch (e) {
    console.warn("[storage] 분석 결과 저장 실패:", e);
  }
}

// ─────────────────────────────────────────────────────────────
// 분석 결과 — 복원 (loadAnalysisFromStorage)
// ─────────────────────────────────────────────────────────────

/**
 * localStorage에서 최근 분석 결과 복원
 * - localStorage → sessionStorage 순으로 폴백 시도
 * - JSON.parse 실패 시 안전하게 null 반환
 */
export function loadAnalysisFromStorage(): StoredAnalysis | null {
  if (!isBrowser()) return null;

  // 1차: localStorage 통합 구조
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.LATEST_ANALYSIS);
    if (stored) {
      const envelope: StoredAnalysisEnvelope = JSON.parse(stored);
      const analysis = envelope?.analysis;
      if (analysis?.ai_response_json && analysis?.questions?.length > 0) {
        return analysis;
      }
    }
  } catch (e) {
    console.warn("[storage] localStorage 복원 실패:", e);
  }

  // 2차: sessionStorage 레거시 폴백
  try {
    const sessionResult = sessionStorage.getItem(STORAGE_KEYS.SESSION_RESULT);
    const sessionQuestions = sessionStorage.getItem(STORAGE_KEYS.SESSION_QUESTIONS);
    if (sessionResult && sessionQuestions) {
      const result = JSON.parse(sessionResult);
      const questions = JSON.parse(sessionQuestions);
      if (result && Array.isArray(questions)) {
        return {
          ai_response_json: result,
          ai_score: null,
          questions: questions.map((q: any) => ({
            question_text: q.question || q.question_text || "",
            input_text: q.answer || q.input_text || "",
          })),
          company: sessionStorage.getItem(STORAGE_KEYS.SESSION_COMPANY) || "",
          jobKeyword: sessionStorage.getItem(STORAGE_KEYS.SESSION_JOB) || "",
          created_at: new Date().toISOString(),
          project_id: null,
        };
      }
    }
  } catch (e) {
    console.warn("[storage] sessionStorage 복원 실패:", e);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// 분석 결과 — 리포트 데이터 추출
// ─────────────────────────────────────────────────────────────

/**
 * 분석 결과의 AI 응답 JSON만 추출 (ReportResult 호환)
 * - questionTabs 구조가 있는지 검증
 */
export function loadReportData(): Record<string, unknown> | null {
  const stored = loadAnalysisFromStorage();
  if (!stored) return null;

  const result = stored.ai_response_json;
  if (
    result &&
    Array.isArray((result as any).questionTabs) &&
    (result as any).questionTabs.length > 0
  ) {
    return result;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 분석 결과 — 삭제
// ─────────────────────────────────────────────────────────────

/** 분석 결과 삭제 (localStorage + sessionStorage 모두) */
export function clearAnalysisResult(): void {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(STORAGE_KEYS.LATEST_ANALYSIS);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_RESULT);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_QUESTIONS);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_COMPANY);
    sessionStorage.removeItem(STORAGE_KEYS.SESSION_JOB);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────
// 초안 — 저장/복원/삭제
// ─────────────────────────────────────────────────────────────

/** 작성 중인 자소서 초안 저장 */
export function saveDraft(draft: StoredDraft): void {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** 저장된 초안 복원 */
export function loadDraft(): StoredDraft | null {
  if (!isBrowser()) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (stored) {
      const parsed: StoredDraft = JSON.parse(stored);
      if (parsed?.questions?.length > 0 && parsed.questions.some((q) => q.answer?.trim())) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 초안 삭제 */
export function clearDraft(): void {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────
// 하위 호환 별칭 (기존 코드에서 사용 중인 함수명 유지)
// ─────────────────────────────────────────────────────────────

/** @deprecated saveAnalysisToStorage() 사용 권장 */
export const saveAnalysisResult = saveAnalysisToStorage;

/** @deprecated loadAnalysisFromStorage() 사용 권장 */
export const loadAnalysisResult = loadAnalysisFromStorage;

// ─────────────────────────────────────────────────────────────
// 익명 사용자 UUID — Feedback 등 비로그인 기능에 사용
// ─────────────────────────────────────────────────────────────

/**
 * 익명 사용자 UUID를 조회하거나 발급
 * - localStorage에 저장하여 세션 간 동일 UUID 유지
 * - 향후 로그인 시 실제 계정으로 병합 가능
 */
export function getAnonymousUserId(): string {
  if (!isBrowser()) return "";

  try {
    const existing = localStorage.getItem(STORAGE_KEYS.ANONYMOUS_USER_ID);
    if (existing) return existing;

    const newId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.ANONYMOUS_USER_ID, newId);
    return newId;
  } catch {
    return crypto.randomUUID();
  }
}

// ─────────────────────────────────────────────────────────────
// Feedback — 로컬 캐싱 (중복 투표 방지 + 상태 복원)
// ─────────────────────────────────────────────────────────────

/** Feedback 로컬 캐시 구조 */
export interface StoredFeedback {
  rating: "THUMBS_UP" | "THUMBS_DOWN";
  comment?: string;
  savedAt: string;
}

/** 특정 분석에 대한 Feedback을 localStorage에 캐싱 */
export function saveFeedbackLocally(analysisId: string, feedback: StoredFeedback): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.FEEDBACK_PREFIX + analysisId,
      JSON.stringify(feedback)
    );
  } catch {
    /* ignore */
  }
}

/** 특정 분석에 대한 캐싱된 Feedback 조회 */
export function loadFeedbackLocally(analysisId: string): StoredFeedback | null {
  if (!isBrowser()) return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FEEDBACK_PREFIX + analysisId);
    if (stored) return JSON.parse(stored) as StoredFeedback;
  } catch {
    /* ignore */
  }
  return null;
}
