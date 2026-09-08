import { useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KpiGrid } from "@/components/admin/dashboard/KpiGrid";
import { SignupChart } from "@/components/admin/dashboard/SignupChart";
import { AnalysisChart } from "@/components/admin/dashboard/AnalysisChart";
import { RecentActivity } from "@/components/admin/dashboard/RecentActivity";
import { VisitorChart } from "@/components/admin/dashboard/VisitorChart";
import { DailyStatsTable } from "@/components/admin/dashboard/DailyStatsTable";
import {
  DASHBOARD_RANGE_OPTIONS,
  useDashboardData,
  type DashboardRangeDays,
} from "@/hooks/admin/useDashboardData";

/**
 * DashboardPage
 *
 * 관리자 대시보드 메인 페이지.
 *
 * 레이아웃 (데스크톱):
 * ┌──────────────────────────────────────────────────┐
 * │ KpiGrid (6열 카드)                               │
 * ├──────────────────────────────────────────────────┤
 * │ VisitorChart (전체 너비)                         │
 * ├─────────────────────────┬────────────────────────┤
 * │ SignupChart (좌)         │ AnalysisChart (우)     │
 * ├─────────────────────────┴────────────────────────┤
 * │ DailyStatsTable (전체 너비)                      │
 * ├──────────────────────────────────────────────────┤
 * │ RecentActivity (전체 너비)                       │
 * └──────────────────────────────────────────────────┘
 *
 * 데이터 갱신:
 * - 5분 자동 갱신 (useDashboardData 내부)
 * - 헤더 Refresh 버튼으로 수동 갱신
 * - 마지막 갱신 시각 표시
 * - 기간(7·30·90일)은 차트와 일별 표에만 적용되고 KPI 카드는 항상 오늘 기준
 */
export default function DashboardPage() {
  const [days, setDays] = useState<DashboardRangeDays>(7);
  const { data, isLoading, error, refresh, lastRefreshed } =
    useDashboardData(days);

  const refreshLabel = lastRefreshed
    ? `${lastRefreshed.getHours().toString().padStart(2, "0")}:${lastRefreshed
        .getMinutes()
        .toString()
        .padStart(2, "0")} 갱신`
    : "";

  return (
    <div className="space-y-5">
      {/* ── 페이지 헤더 ───────────────────────────────────── */}
      <AdminPageHeader
        title="Dashboard"
        description="PassMate 서비스 현황을 한눈에 확인합니다."
        actions={
          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-md border bg-card p-0.5"
              role="group"
              aria-label="차트 기간"
            >
              {DASHBOARD_RANGE_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  size="sm"
                  variant={option === days ? "secondary" : "ghost"}
                  className="h-7 px-2.5 text-xs"
                  aria-pressed={option === days}
                  onClick={() => setDays(option)}
                  id={`dashboard-range-${option}`}
                >
                  {option}일
                </Button>
              ))}
            </div>
            {refreshLabel && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {refreshLabel}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="gap-1.5"
              id="dashboard-refresh-btn"
            >
              <RefreshCw
                className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              새로고침
            </Button>
          </div>
        }
      />

      {/* ── 에러 알림 ─────────────────────────────────────── */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* ── KPI 카드 그리드 ───────────────────────────────── */}
      <KpiGrid
        data={data?.kpi ?? null}
        paymentSummary={data?.paymentSummary ?? null}
        isLoading={isLoading}
      />

      {/* ── 방문 추이 (전체 너비) ─────────────────────────── */}
      <VisitorChart
        data={data?.visitorChart ?? []}
        days={days}
        isLoading={isLoading}
      />

      {/* ── 차트 영역 (2열) ───────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <SignupChart
          data={data?.signupChart ?? []}
          days={days}
          isLoading={isLoading}
        />
        <AnalysisChart
          data={data?.analysisChart ?? []}
          days={days}
          isLoading={isLoading}
        />
      </div>

      {/* ── 일별 집계 표 ──────────────────────────────────── */}
      <DailyStatsTable
        visitorChart={data?.visitorChart ?? []}
        signupChart={data?.signupChart ?? []}
        analysisChart={data?.analysisChart ?? []}
        days={days}
        isLoading={isLoading}
      />

      {/* ── 최근 활동 ─────────────────────────────────────── */}
      <RecentActivity
        data={data?.recentActivity ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
