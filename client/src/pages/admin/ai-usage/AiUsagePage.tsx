import { RefreshCw, AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AiUsageSummaryCards } from "@/components/admin/ai-usage/AiUsageSummaryCards";
import { ModelUsageSection } from "@/components/admin/ai-usage/ModelUsageSection";
import { UsageChartsSection } from "@/components/admin/ai-usage/UsageChartsSection";
import { useAiUsageData } from "@/hooks/admin/useAiUsageData";

export default function AiUsagePage() {
  const { data, isLoading, error, refresh, lastRefreshed } = useAiUsageData();

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
        title="AI Usage"
        description="인프라 가동 리소스 및 모델 연동 비용을 모니터링합니다."
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
              id="ai-usage-refresh-btn"
            >
              <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
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

      {/* ── 요약 통계 카드 ───────────────────────────────── */}
      <AiUsageSummaryCards summary={data?.summary ?? null} isLoading={isLoading} />

      {/* ── 트렌드 그래프 ─────────────────────────────────── */}
      <UsageChartsSection
        hourlyData={data?.hourlyUsage ?? []}
        dailyData={data?.dailyUsage ?? []}
        isLoading={isLoading}
      />

      {/* ── 모델별 통계 ──────────────────────────────────── */}
      <ModelUsageSection data={data?.modelUsage ?? []} isLoading={isLoading} />
    </div>
  );
}
