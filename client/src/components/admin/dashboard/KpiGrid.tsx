import {
  Users,
  UserPlus,
  FileText,
  Bot,
  CreditCard,
  Activity,
} from "lucide-react";
import { KpiCard } from "./KpiCard";
import type { KpiData } from "@/hooks/admin/useDashboardData";

interface KpiGridProps {
  data: KpiData | null;
  isLoading: boolean;
}

/**
 * KpiGrid
 *
 * 대시보드 최상단 KPI 카드 6종을 반응형 그리드로 배치합니다.
 *
 * 레이아웃:
 * - 모바일  (< sm)  : 2열 × 3행
 * - 태블릿 (sm~lg) : 3열 × 2행
 * - 데스크톱 (≥ lg): 6열 × 1행
 *
 * 카드 순서는 운영자의 의사결정 우선순위를 반영합니다:
 * 현재 상태(온라인) → 오늘 유입 → 비용/매출
 */
export function KpiGrid({ data, isLoading }: KpiGridProps) {
  const kpi = data;

  // AI 비용: USD → 소수 4자리까지 표시
  const aiCostDisplay =
    kpi?.todayAiCost != null
      ? `$${kpi.todayAiCost.toFixed(4)}`
      : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. 현재 온라인 사용자 — 실시간 강조 */}
      <KpiCard
        title="현재 온라인"
        value={kpi?.onlineUsers ?? null}
        icon={Activity}
        description="최근 30분 활성"
        variant="highlight"
        isLoading={isLoading}
      />

      {/* 2. 오늘 방문자 (분석 시작 유저 수로 proxy) */}
      <KpiCard
        title="오늘 방문자"
        value={kpi?.todayVisitors ?? null}
        icon={Users}
        description="분석 시작 기준"
        isLoading={isLoading}
      />

      {/* 3. 오늘 가입자 */}
      <KpiCard
        title="오늘 가입자"
        value={kpi?.todaySignups ?? null}
        icon={UserPlus}
        isLoading={isLoading}
      />

      {/* 4. 오늘 분석 횟수 */}
      <KpiCard
        title="오늘 분석"
        value={kpi?.todayAnalyses ?? null}
        icon={FileText}
        isLoading={isLoading}
      />

      {/* 5. 오늘 AI 비용 (비용 감소가 긍정) */}
      <KpiCard
        title="오늘 AI 비용"
        value={aiCostDisplay}
        icon={Bot}
        description="USD"
        positiveIsGood={false}
        isLoading={isLoading}
      />

      {/* 6. 오늘 매출 — payments 미구현 */}
      <KpiCard
        title="오늘 매출"
        value={null}
        icon={CreditCard}
        unavailable
        isLoading={false}
      />
    </div>
  );
}
