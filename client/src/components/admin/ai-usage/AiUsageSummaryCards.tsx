import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import { Cpu, DollarSign, Clock, AlertTriangle } from "lucide-react";
import type { AiUsageSummary } from "@/hooks/admin/useAiUsageData";

interface AiUsageSummaryCardsProps {
  summary: AiUsageSummary | null;
  isLoading: boolean;
}

export function AiUsageSummaryCards({ summary, isLoading }: AiUsageSummaryCardsProps) {
  // 오늘 비용 포맷
  const costDisplay =
    summary?.todayCost != null
      ? `$${summary.todayCost.toFixed(4)}`
      : null;

  // 평균 응답 시간 포맷
  const responseTimeDisplay =
    summary?.avgResponseTimeMs != null
      ? summary.avgResponseTimeMs < 1000
        ? `${summary.avgResponseTimeMs} ms`
        : `${(summary.avgResponseTimeMs / 1000).toFixed(2)} s`
      : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. 오늘 토큰 사용량 */}
      <KpiCard
        title="오늘 사용 토큰"
        value={summary?.todayTokens.total ?? null}
        icon={Cpu}
        description={
          summary
            ? `Prompt: ${summary.todayTokens.prompt.toLocaleString("ko-KR")} / Comp: ${summary.todayTokens.completion.toLocaleString("ko-KR")}`
            : undefined
        }
        isLoading={isLoading}
      />

      {/* 2. 오늘 AI 비용 (비용 증가가 부정) */}
      <KpiCard
        title="오늘 AI 누적 비용"
        value={costDisplay}
        icon={DollarSign}
        description="USD 기준"
        positiveIsGood={false}
        isLoading={isLoading}
      />

      {/* 3. 평균 응답 속도 */}
      <KpiCard
        title="평균 응답 속도"
        value={responseTimeDisplay}
        icon={Clock}
        description="API 처리 속도"
        isLoading={isLoading}
      />

      {/* 4. 실패율 */}
      <KpiCard
        title="분석 실패율"
        value={summary?.failureRate != null ? `${summary.failureRate}%` : null}
        icon={AlertTriangle}
        description="전체 API 에러율"
        positiveIsGood={false}
        isLoading={isLoading}
        variant={summary?.failureRate && summary.failureRate > 10 ? "highlight" : "default"}
      />
    </div>
  );
}
