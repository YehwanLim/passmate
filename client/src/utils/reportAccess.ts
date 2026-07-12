export const PUBLIC_REPORT_SECTION_COUNT = 2;

const FREE_ANALYSIS_USAGE_KEY = "passmate_free_analysis_usage";

export interface FreeAnalysisStatus {
  hasUsedFreeAnalysis: boolean;
  isCurrentAnalysisClaimed: boolean;
}

interface FreeAnalysisUsageRecord {
  analysisKey: string;
  usedAt: string;
}

type FreeAnalysisUsageMap = Record<string, FreeAnalysisUsageRecord>;

export function isReportSectionLocked({
  sectionIndex,
  isAuthenticated,
}: {
  sectionIndex: number;
  isAuthenticated: boolean;
}) {
  return !isAuthenticated && sectionIndex >= PUBLIC_REPORT_SECTION_COUNT;
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readUsageMap(storage: Storage | null = getBrowserStorage()) {
  if (!storage) return {};

  try {
    const raw = storage.getItem(FREE_ANALYSIS_USAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as FreeAnalysisUsageMap;
  } catch {
    return {};
  }
}

function writeUsageMap(
  usageMap: FreeAnalysisUsageMap,
  storage: Storage | null = getBrowserStorage(),
) {
  if (!storage) return;
  storage.setItem(FREE_ANALYSIS_USAGE_KEY, JSON.stringify(usageMap));
}

export function getFreeAnalysisStatus(
  userId: string | null | undefined,
  analysisKey: string | null | undefined,
  storage: Storage | null = getBrowserStorage(),
): FreeAnalysisStatus {
  if (!userId || !analysisKey) {
    return {
      hasUsedFreeAnalysis: false,
      isCurrentAnalysisClaimed: false,
    };
  }

  const record = readUsageMap(storage)[userId];

  return {
    hasUsedFreeAnalysis: Boolean(record),
    isCurrentAnalysisClaimed: record?.analysisKey === analysisKey,
  };
}

export function markFreeAnalysisUsed(
  userId: string | null | undefined,
  analysisKey: string | null | undefined,
  storage: Storage | null = getBrowserStorage(),
) {
  if (!userId || !analysisKey) return;

  const usageMap = readUsageMap(storage);
  if (usageMap[userId]) return;

  usageMap[userId] = {
    analysisKey,
    usedAt: new Date().toISOString(),
  };
  writeUsageMap(usageMap, storage);
}

export function shouldShowNextAnalysisNotice(status: FreeAnalysisStatus) {
  return status.hasUsedFreeAnalysis && !status.isCurrentAnalysisClaimed;
}
