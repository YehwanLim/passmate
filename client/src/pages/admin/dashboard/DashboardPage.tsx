import { RefreshCw, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KpiGrid } from "@/components/admin/dashboard/KpiGrid";
import { SignupChart } from "@/components/admin/dashboard/SignupChart";
import { AnalysisChart } from "@/components/admin/dashboard/AnalysisChart";
import { RecentActivity } from "@/components/admin/dashboard/RecentActivity";
import { useDashboardData } from "@/hooks/admin/useDashboardData";

/**
 * DashboardPage
 *
 * 관리자 대시보드 메인 페이지.
 *
 * 레이아웃 (데스크톱):
 * ┌──────────────────────────────────────────────────┐
 * │ KpiGrid (6열 카드)                               │
 * ├─────────────────────────┬────────────────────────┤
 * │ SignupChart (좌)         │ AnalysisChart (우)     │
 * ├─────────────────────────┴────────────────────────┤
 * │ RecentActivity (전체 너비)                       │
 * └──────────────────────────────────────────────────┘
 *
 * 데이터 갱신:
 * - 5분 자동 갱신 (useDashboardData 내부)
 * - 헤더 Refresh 버튼으로 수동 갱신
 * - 마지막 갱신 시각 표시
 */
export default function DashboardPage() {
  const { data, isLoading, error, refresh, lastRefreshed } =
    useDashboardData();

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
      <KpiGrid data={data?.kpi ?? null} isLoading={isLoading} />

      {/* ── 차트 영역 (2열) ───────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        <SignupChart
          data={data?.signupChart ?? []}
          isLoading={isLoading}
        />
        <AnalysisChart
          data={data?.analysisChart ?? []}
          isLoading={isLoading}
        />
      </div>

      {/* ── 최근 활동 ─────────────────────────────────────── */}
      <RecentActivity
        data={data?.recentActivity ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
