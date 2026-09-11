import {
  buildFunnelAnalyticsFromUsage,
  getFunnelAnalytics,
  type FunnelAnalytics,
  type FunnelUsagePayload,
  type PeriodKey,
} from "@/pages/admin/analytics/funnelAnalytics";
import { useAdminResource } from "./useAdminResource";

/** 선택 기간의 퍼널 집계. 실패하면 빈 퍼널을 보여 주고 오류 문구만 띄운다. */
export function useFunnelAnalyticsData(period: PeriodKey) {
  const { data, isLoading, error, refresh, lastRefreshed } = useAdminResource<FunnelAnalytics, FunnelUsagePayload>(
    `/api/admin/usage?view=funnel&period=${period}`,
    {
      select: (source) => buildFunnelAnalyticsFromUsage(period, source),
      fallback: () => getFunnelAnalytics(period),
      errorMessage: "퍼널 데이터를 불러오지 못했습니다.",
    },
  );
  // fallback 이 있으므로 data 는 항상 채워져 있다.
  return { data: data ?? getFunnelAnalytics(period), isLoading, error, refresh, lastRefreshed };
}
