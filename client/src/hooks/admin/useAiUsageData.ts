import { useAdminResource } from "./useAdminResource";

export interface AiUsageSummary { todayTokens: { prompt: number; completion: number; total: number; }; todayCost: number; avgResponseTimeMs: number; failureRate: number; }
export interface ModelUsageItem { modelName: string; provider: string; calls: number; tokens: number; cost: number; }
export interface HourlyUsagePoint { hour: string; tokens: number; cost: number; }
export interface DailyUsagePoint { date: string; tokens: number; cost: number; }
export interface AiUsageData { summary: AiUsageSummary; modelUsage: ModelUsageItem[]; hourlyUsage: HourlyUsagePoint[]; dailyUsage: DailyUsagePoint[]; }

const POLL_MS = 5 * 60 * 1000;
const MOUNTED_AT = new Date();

export function useAiUsageData() {
  return useAdminResource<AiUsageData>("/api/admin/usage?view=ai", {
    pollMs: POLL_MS,
    errorMessage: "AI 통계 데이터를 로드하지 못했습니다.",
    initialLastRefreshed: MOUNTED_AT,
  });
}
