import { describe, expect, it } from "vitest";

import {
  PUBLIC_REPORT_SECTION_COUNT,
  getFreeAnalysisStatus,
  isReportSectionLocked,
  markFreeAnalysisUsed,
  shouldShowNextAnalysisNotice,
} from "./reportAccess";

function createMemoryStorage() {
  const store = new Map<string, string>();

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  } as Storage;
}

describe("report access gating", () => {
  it("keeps the first two report sections public for anonymous users", () => {
    expect(PUBLIC_REPORT_SECTION_COUNT).toBe(2);
    expect(isReportSectionLocked({ sectionIndex: 0, isAuthenticated: false })).toBe(false);
    expect(isReportSectionLocked({ sectionIndex: 1, isAuthenticated: false })).toBe(false);
    expect(isReportSectionLocked({ sectionIndex: 2, isAuthenticated: false })).toBe(true);
  });

  it("unlocks every section for authenticated users", () => {
    expect(isReportSectionLocked({ sectionIndex: 6, isAuthenticated: true })).toBe(false);
  });

  it("tracks one free full analysis per user without marking a second result free", () => {
    const storage = createMemoryStorage();

    expect(getFreeAnalysisStatus("user-1", "analysis-a", storage)).toEqual({
      hasUsedFreeAnalysis: false,
      isCurrentAnalysisClaimed: false,
    });

    markFreeAnalysisUsed("user-1", "analysis-a", storage);
    expect(getFreeAnalysisStatus("user-1", "analysis-a", storage)).toEqual({
      hasUsedFreeAnalysis: true,
      isCurrentAnalysisClaimed: true,
    });

    const nextStatus = getFreeAnalysisStatus("user-1", "analysis-b", storage);
    expect(nextStatus).toEqual({
      hasUsedFreeAnalysis: true,
      isCurrentAnalysisClaimed: false,
    });
    expect(shouldShowNextAnalysisNotice(nextStatus)).toBe(true);
  });
});
