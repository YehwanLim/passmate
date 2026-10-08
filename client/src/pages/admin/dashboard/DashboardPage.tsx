import { useState } from "react";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminPeriodPicker } from "@/components/admin/shared/AdminPeriodPicker";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { KpiGrid } from "@/components/admin/dashboard/KpiGrid";
import { RecentActivity } from "@/components/admin/dashboard/RecentActivity";
import { DailyStatsTable } from "@/components/admin/dashboard/DailyStatsTable";
import { useDashboardData } from "@/hooks/admin/useDashboardData";
import { adminPeriodLabel, type AdminPeriod } from "@/lib/adminPeriod";

/**
 * DashboardPage — 관리자 홈.
 *
 * 레이아웃:
 * ┌──────────────────────────────────────────────────┐
 * │ KpiGrid (오늘 숫자, 기간과 무관)                  │
 * ├──────────────────────────────────────────────────┤
 * │ DailyStatsTable (기간 버튼: 최근 7일·지난주·30일·월별) │
 * ├──────────────────────────────────────────────────┤
 * │ RecentActivity (최근 분석 10건)                   │
 * └──────────────────────────────────────────────────┘
 *
 * 5분마다 자동 갱신, 머리말 새로고침으로 수동 갱신.
 */
export default function DashboardPage() {
  const [period, setPeriod] = useState<AdminPeriod>("7d");
  const { data, isLoading, error, refresh, lastRefreshed } = useDashboardData(period);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="홈"
        description="오늘 숫자와 기간별 표."
        actions={
          <AdminRefreshControl
            lastRefreshed={lastRefreshed}
            isLoading={isLoading}
            onRefresh={refresh}
            id="dashboard-refresh-btn"
          />
        }
      />

      <AdminErrorAlert message={error} />

      <KpiGrid
        data={data?.kpi ?? null}
        paymentSummary={data?.paymentSummary ?? null}
        isLoading={isLoading}
      />

      <DailyStatsTable
        visitorChart={data?.visitorChart ?? []}
        signupChart={data?.signupChart ?? []}
        analysisChart={data?.analysisChart ?? []}
        paymentChart={data?.paymentChart ?? []}
        aiCostChart={data?.aiCostChart ?? []}
        periodLabel={adminPeriodLabel(period)}
        monthly={period === "months"}
        isLoading={isLoading}
        actions={<AdminPeriodPicker value={period} onChange={setPeriod} idPrefix="dashboard" />}
      />

      <RecentActivity
        data={data?.recentActivity ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
