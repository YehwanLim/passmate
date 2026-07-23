// Browser persistence is intentionally delete-only. Reports and resume text
// are retrieved from authenticated APIs instead of device storage.

export const STORAGE_KEYS = {
  LATEST_ANALYSIS: "passmate_latest_analysis",
  DRAFT: "passmate_draft",
  ANONYMOUS_USER_ID: "passmate_anonymous_uid",
  FEEDBACK_PREFIX: "passmate_feedback_",
  SESSION_RESULT: "passmate_analysis_result",
  SESSION_QUESTIONS: "passmate_raw_questions",
  SESSION_COMPANY: "passmate_company",
  SESSION_JOB: "passmate_job",
} as const;

export interface StoredQuestionItem {
  question_text: string;
  input_text: string;
}

export interface StoredAnalysis {
  ai_response_json: Record<string, unknown>;
  ai_score: number | null;
  questions: StoredQuestionItem[];
  company: string;
  jobKeyword: string;
  created_at: string;
  project_id: string | null;
  analysis_id?: string;
}

export interface StoredDraft {
  company: string;
  selectedJob: string | null;
  customJob: string;
  questions: Array<{ id: string; question: string; answer: string }>;
}

export interface StoredFeedback {
  rating: "THUMBS_UP" | "THUMBS_DOWN";
  comment?: string;
  savedAt: string;
}

function browserStorages(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.localStorage, window.sessionStorage];
}

function removeLegacyKey(key: string): void {
  for (const storage of browserStorages()) {
    try {
      storage.removeItem(key);
    } catch {
      // Storage can be unavailable in private browser modes.
    }
  }
}

/** Removes every legacy PassMate entry on this device. */
export function clearPassMateStorage(): void {
  for (const storage of browserStorages()) {
    try {
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith("passmate_")) storage.removeItem(key);
      }
    } catch {
      // Storage can be unavailable in private browser modes.
    }
  }
}

/** @deprecated Browser report persistence is disabled. */
export function saveAnalysisToStorage(_params: {
  result: Record<string, unknown>;
  questions: Array<{ question: string; answer: string }>;
  company: string;
  jobKeyword: string;
  aiScore?: number | null;
  projectId?: string;
  analysisId?: string;
}): void {
  clearAnalysisResult();
}

/** @deprecated Browser report persistence is disabled. */
export function loadAnalysisFromStorage(): StoredAnalysis | null {
  clearAnalysisResult();
  return null;
}

/** @deprecated Browser report persistence is disabled. */
export function loadReportData(): Record<string, unknown> | null {
  clearAnalysisResult();
  return null;
}

export function clearAnalysisResult(): void {
  for (const key of [
    STORAGE_KEYS.LATEST_ANALYSIS,
    STORAGE_KEYS.SESSION_RESULT,
    STORAGE_KEYS.SESSION_QUESTIONS,
    STORAGE_KEYS.SESSION_COMPANY,
    STORAGE_KEYS.SESSION_JOB,
  ]) {
    removeLegacyKey(key);
  }
}

/** @deprecated Resume drafts are never persisted in browser storage. */
export function saveDraft(_draft: StoredDraft): void {
  clearDraft();
}

/** @deprecated Resume drafts are never persisted in browser storage. */
export function loadDraft(): StoredDraft | null {
  clearDraft();
  return null;
}

export function clearDraft(): void {
  removeLegacyKey(STORAGE_KEYS.DRAFT);
}

export const saveAnalysisResult = saveAnalysisToStorage;
export const loadAnalysisResult = loadAnalysisFromStorage;

/** @deprecated Anonymous browser identifiers are disabled. */
export function getAnonymousUserId(): string {
  removeLegacyKey(STORAGE_KEYS.ANONYMOUS_USER_ID);
  return "";
}

/** @deprecated Feedback cache is disabled. */
export function saveFeedbackLocally(analysisId: string, _feedback: StoredFeedback): void {
  removeLegacyKey(STORAGE_KEYS.FEEDBACK_PREFIX + analysisId);
}

/** @deprecated Feedback cache is disabled. */
export function loadFeedbackLocally(analysisId: string): StoredFeedback | null {
  removeLegacyKey(STORAGE_KEYS.FEEDBACK_PREFIX + analysisId);
  return null;
}
