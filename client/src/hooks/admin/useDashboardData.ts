import type { PurchaseProduct } from "@/lib/pricing";
import { useAdminResource } from "./useAdminResource";

// 서버(lib/admin-handlers/dashboard.js 의 DASHBOARD_RANGE_DAYS)와 같은 목록. 밖의 값은 서버가 7일로 되돌린다.
export const DASHBOARD_RANGE_OPTIONS = [7, 30, 90] as const;
export type DashboardRangeDays = (typeof DASHBOARD_RANGE_OPTIONS)[number];

export interface KpiData { todayVisitors: number | null; todayPageViews: number | null; todaySignups: number | null; todayAnalyses: number | null; todayAiCost: number | null; onlineUsers: number | null; }
export interface PaymentSummary { total: number; today: number; byProduct: Record<PurchaseProduct | "UNKNOWN", number>; }
export interface ChartPoint { date: string; count: number; }
export interface VisitorChartPoint { date: string; visitors: number; pageViews: number; }
export interface ActivityItem { id: string; userEmail: string; status: "PENDING" | "SUCCESS" | "FAILED"; createdAt: string; modelName: string | null; }
export interface DashboardData { range: { days: DashboardRangeDays }; kpi: KpiData; paymentSummary: PaymentSummary; visitorChart: VisitorChartPoint[]; signupChart: ChartPoint[]; analysisChart: ChartPoint[]; recentActivity: ActivityItem[]; }

const POLL_MS = 5 * 60 * 1000;
const MOUNTED_AT = new Date();

export function useDashboardData(days: DashboardRangeDays = 7) {
  return useAdminResource<DashboardData>(`/api/admin/dashboard?days=${days}`, {
    pollMs: POLL_MS,
    errorMessage: "데이터를 불러오지 못했습니다.",
    initialLastRefreshed: MOUNTED_AT,
  });
}
