import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export interface AiUsageSummary { todayTokens: { prompt: number; completion: number; total: number; }; todayCost: number; avgResponseTimeMs: number; failureRate: number; }
export interface ModelUsageItem { modelName: string; provider: string; calls: number; tokens: number; cost: number; }
export interface HourlyUsagePoint { hour: string; tokens: number; cost: number; }
export interface DailyUsagePoint { date: string; tokens: number; cost: number; }
export interface AiUsageData { summary: AiUsageSummary; modelUsage: ModelUsageItem[]; hourlyUsage: HourlyUsagePoint[]; dailyUsage: DailyUsagePoint[]; }
type AsyncState<T> = { data: T | null; isLoading: boolean; error: string | null; };

export function useAiUsageData() {
  const [state, setState] = useState<AsyncState<AiUsageData>>({ data: null, isLoading: true, error: null }); const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const fetchUsage = useCallback(async () => {
    setState((previous) => ({ ...previous, isLoading: true, error: null }));
    try { const data = await adminApiFetch<AiUsageData>("/api/admin/usage?view=ai"); setState({ data, isLoading: false, error: null }); setLastRefreshed(new Date()); }
    catch (cause) { setState({ data: null, isLoading: false, error: cause instanceof Error ? cause.message : "AI 통계 데이터를 로드하지 못했습니다." }); }
  }, []);
  useEffect(() => { fetchUsage(); const interval = setInterval(fetchUsage, 5 * 60 * 1000); return () => clearInterval(interval); }, [fetchUsage]);
  return { ...state, refresh: fetchUsage, lastRefreshed };
}
