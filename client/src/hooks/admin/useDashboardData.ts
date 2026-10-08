import type { AdminPeriod } from "@/lib/adminPeriod";
import type { PurchaseProduct } from "@/lib/pricing";
import { useAdminResource } from "./useAdminResource";

export interface KpiData { todayVisitors: number | null; todayPageViews: number | null; todaySignups: number | null; todayAnalyses: number | null; todayAiCost: number | null; onlineUsers: number | null; }
export interface PaymentSummary { total: number; today: number; byProduct: Record<PurchaseProduct | "UNKNOWN", number>; }
export interface ChartPoint { date: string; count: number; }
export interface VisitorChartPoint { date: string; visitors: number; pageViews: number; }
/** 칸별 결제 건수와 상품별 건수(추정 매출은 lib/pricing.ts estimateRevenue). */
export interface PaymentChartPoint { date: string; count: number; byProduct: Record<PurchaseProduct | "UNKNOWN", number>; }
export interface AiCostChartPoint { date: string; cost: number; }
export interface ActivityItem { id: string; userEmail: string; status: "PENDING" | "SUCCESS" | "FAILED"; createdAt: string; modelName: string | null; }
/** 칸(date)은 하루("MM/DD") 또는 월별일 때 한 달("YYYY-MM"). KPI 는 기간과 무관하게 오늘 기준. */
export interface DashboardData { range: { period: AdminPeriod }; kpi: KpiData; paymentSummary: PaymentSummary; visitorChart: VisitorChartPoint[]; signupChart: ChartPoint[]; analysisChart: ChartPoint[]; paymentChart: PaymentChartPoint[]; aiCostChart: AiCostChartPoint[]; recentActivity: ActivityItem[]; }

const POLL_MS = 5 * 60 * 1000;
const MOUNTED_AT = new Date();

export function useDashboardData(period: AdminPeriod = "7d") {
  return useAdminResource<DashboardData>(`/api/admin/dashboard?period=${period}`, {
    pollMs: POLL_MS,
    errorMessage: "데이터를 불러오지 못했습니다.",
    initialLastRefreshed: MOUNTED_AT,
  });
}
