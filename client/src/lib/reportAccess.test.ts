import { describe, expect, it } from "vitest";

import { getFreeAnalysisStatus, isReportSectionLocked, markFreeAnalysisUsed, shouldShowNextAnalysisNotice } from "./reportAccess";

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
  it("locks every report section for anonymous users", () => {
    expect(isReportSectionLocked({ sectionIndex: 0, isAuthenticated: false })).toBe(true);
    expect(isReportSectionLocked({ sectionIndex: 6, isAuthenticated: false })).toBe(true);
  });

  it("unlocks every section for authenticated users", () => {
    expect(isReportSectionLocked({ sectionIndex: 6, isAuthenticated: true })).toBe(false);
  });

  it("does not persist client-side entitlement or analysis identifiers", () => {
    const storage = createMemoryStorage();

    expect(getFreeAnalysisStatus("user-1", "analysis-a", storage)).toEqual({
      hasUsedFreeAnalysis: false,
      isCurrentAnalysisClaimed: false,
    });

    markFreeAnalysisUsed("user-1", "analysis-a", storage);
    expect(getFreeAnalysisStatus("user-1", "analysis-a", storage)).toEqual({
      hasUsedFreeAnalysis: false,
      isCurrentAnalysisClaimed: false,
    });
    expect(shouldShowNextAnalysisNotice(getFreeAnalysisStatus("user-1", "analysis-b", storage))).toBe(false);
  });
});
