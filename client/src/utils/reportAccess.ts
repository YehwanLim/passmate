// Report authorization and free-credit accounting are server responsibilities.
// This module intentionally stores no user or analysis identifier in the browser.

export interface FreeAnalysisStatus {
  hasUsedFreeAnalysis: boolean;
  isCurrentAnalysisClaimed: boolean;
}

export function isReportSectionLocked({ isAuthenticated }: {
  sectionIndex: number;
  isAuthenticated: boolean;
}) {
  return !isAuthenticated;
}

export function getFreeAnalysisStatus(
  _userId: string | null | undefined,
  _analysisKey: string | null | undefined,
  _storage?: Storage | null,
): FreeAnalysisStatus {
  return { hasUsedFreeAnalysis: false, isCurrentAnalysisClaimed: false };
}

export function markFreeAnalysisUsed(
  _userId: string | null | undefined,
  _analysisKey: string | null | undefined,
  _storage?: Storage | null,
) {
  // Intentionally no-op: the server reservation is the sole credit record.
}

export function shouldShowNextAnalysisNotice(_status: FreeAnalysisStatus) {
  return false;
}
