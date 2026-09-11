import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { AiUsageSummaryCards } from "@/components/admin/ai-usage/AiUsageSummaryCards";
import { ModelUsageSection } from "@/components/admin/ai-usage/ModelUsageSection";
import { UsageChartsSection } from "@/components/admin/ai-usage/UsageChartsSection";
import { useAiUsageData } from "@/hooks/admin/useAiUsageData";

export default function AiUsagePage() {
  const { data, isLoading, error, refresh, lastRefreshed } = useAiUsageData();

  return (
    <div className="space-y-5">
      {/* ── 페이지 헤더 ───────────────────────────────────── */}
      <AdminPageHeader
        title="AI Usage"
        description="인프라 가동 리소스 및 모델 연동 비용을 모니터링합니다."
        actions={
          <div className="flex items-center gap-2">
            <AdminRefreshControl
              lastRefreshed={lastRefreshed}
              isLoading={isLoading}
              onRefresh={refresh}
              id="ai-usage-refresh-btn"
            />
          </div>
        }
      />

      <AdminErrorAlert message={error} />

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
