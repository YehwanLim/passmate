import type { PurchaseProduct } from "@/lib/pricing";
import { useAdminResource } from "./useAdminResource";

// 서버(lib/admin-handlers/dashboard.js 의 DASHBOARD_RANGE_DAYS)와 같은 목록. 밖의 값은 서버가 7일로 되돌린다.
export const DASHBOARD_RANGE_OPTIONS = [7, 30, 90] as const;
export type DashboardRangeDays = (typeof DASHBOARD_RANGE_OPTIONS)[number];

export interface KpiData { todayVisitors: number | null; todayPageViews: number | null; todaySignups: number | null; todayAnalyses: number | null; todayAiCost: number | null; onlineUsers: number | null; }
export interface PaymentSummary { total: number; today: number; byProduct: Record<PurchaseProduct | "UNKNOWN", number>; }
export interface ChartPoint { date: string; count: number; }
export interface VisitorChartPoint { date: string; visitors: number; pageViews: number; }
/** 유입원(utm_source 또는 referrer 호스트)별 고유 방문자. 마지막 행은 유입원을 모르는 방문자일 수 있다. */
export interface SourceSummaryRow { source: string; visitors: number; }
/** 로그인 건강. 인앱 브라우저(Google 로그인이 막히는 WebView)로 들어온 고유 방문자와 로그인 화면 이벤트 건수(lib/site-visits.js CLIENT_EVENT_NAMES). */
export interface LoginHealth {
  inAppVisitors: number;
  events: {
    login_prompt_in_app: number; google_button_unavailable: number; google_signin_failed: number; kakao_start_failed: number;
    /** 랜딩 → 폼 → 가입 퍼널 건수. 구버전 서버 응답엔 없다. */
    landing_cta_click?: number; analyze_form_start?: number; analyze_submit_click?: number; signup_complete?: number;
  };
}
export interface ActivityItem { id: string; userEmail: string; status: "PENDING" | "SUCCESS" | "FAILED"; createdAt: string; modelName: string | null; }
export interface DashboardData { range: { days: DashboardRangeDays }; kpi: KpiData; paymentSummary: PaymentSummary; visitorChart: VisitorChartPoint[]; sourceSummary: SourceSummaryRow[]; loginHealth: LoginHealth; signupChart: ChartPoint[]; analysisChart: ChartPoint[]; recentActivity: ActivityItem[]; }

const POLL_MS = 5 * 60 * 1000;
const MOUNTED_AT = new Date();

export function useDashboardData(days: DashboardRangeDays = 7) {
  return useAdminResource<DashboardData>(`/api/admin/dashboard?days=${days}`, {
    pollMs: POLL_MS,
    errorMessage: "데이터를 불러오지 못했습니다.",
    initialLastRefreshed: MOUNTED_AT,
  });
}
