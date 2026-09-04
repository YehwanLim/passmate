import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export interface KpiData { todayVisitors: number | null; todaySignups: number | null; todayAnalyses: number | null; todayAiCost: number | null; onlineUsers: number | null; }
export interface PaymentSummary { total: number; today: number; byProduct: { SINGLE: number; TRIPLE: number; UNKNOWN: number }; }
export interface ChartPoint { date: string; count: number; }
export interface ActivityItem { id: string; userEmail: string; status: "PENDING" | "SUCCESS" | "FAILED"; createdAt: string; modelName: string | null; }
export interface DashboardData { kpi: KpiData; paymentSummary: PaymentSummary; signupChart: ChartPoint[]; analysisChart: ChartPoint[]; recentActivity: ActivityItem[]; }
type AsyncState<T> = { data: T | null; isLoading: boolean; error: string | null; };

export function useDashboardData() {
  const [state, setState] = useState<AsyncState<DashboardData>>({ data: null, isLoading: true, error: null });
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const fetchAll = useCallback(async () => {
    setState((previous) => ({ ...previous, isLoading: true, error: null }));
    try {
      const data = await adminApiFetch<DashboardData>("/api/admin/dashboard");
      setState({ data, isLoading: false, error: null });
      setLastRefreshed(new Date());
    } catch (error) {
      setState({ data: null, isLoading: false, error: error instanceof Error ? error.message : "데이터를 불러오지 못했습니다." });
    }
  }, []);
  useEffect(() => { fetchAll(); const interval = setInterval(fetchAll, 5 * 60 * 1000); return () => clearInterval(interval); }, [fetchAll]);
  return { ...state, refresh: fetchAll, lastRefreshed };
}
