import { useState } from "react";
import { EngagedTimeCard } from "@/components/admin/behavior/EngagedTimeCard";
import { BehaviorDateBar } from "@/components/admin/behavior/BehaviorDateBar";
import { FeatureUsageTable } from "@/components/admin/behavior/FeatureUsageTable";
import { FunnelTable } from "@/components/admin/behavior/FunnelTable";
import { InterviewStatsCard } from "@/components/admin/behavior/InterviewStatsCard";
import { PopupClicksTable } from "@/components/admin/behavior/PopupClicksTable";
import { RetentionLoginCards } from "@/components/admin/behavior/RetentionLoginCards";
import { SourcesTable } from "@/components/admin/behavior/SourcesTable";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { useBehaviorData } from "@/hooks/admin/useBehaviorData";
import { adminDateRangeLabel, kstDateString, type AdminDateRange } from "@/lib/adminPeriod";

/**
 * BehaviorPage — 사람들이 어디서 와서 어디까지 가고, 다시 오는지.
 * 전부 실제 기록(site_visits·client_events·DB)으로 센다. 운영자 계정 사용은 서버가 뺀다.
 */
export default function BehaviorPage() {
  // 기본은 오늘 하루. 날짜 막대의 ◀ ▶·빠른 버튼·기간 지정이 모두 이 범위를 바꾼다.
  const [range, setRange] = useState<AdminDateRange>(() => {
    const today = kstDateString();
    return { from: today, to: today };
  });
  const { data, isLoading, error, refresh, lastRefreshed } = useBehaviorData(range);
  const periodLabel = adminDateRangeLabel(range);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="사용 행동"
        description="어디서 와서, 어디까지 가고, 다시 오는지."
        actions={
          <AdminRefreshControl lastRefreshed={lastRefreshed} isLoading={isLoading} onRefresh={refresh} id="behavior-refresh-btn" />
        }
      />

      <BehaviorDateBar range={range} onChange={setRange} />

      <AdminErrorAlert message={error} />

      <FunnelTable steps={data?.funnel ?? []} periodLabel={periodLabel} isLoading={isLoading} />
      <InterviewStatsCard data={data?.interviews ?? null} periodLabel={periodLabel} />
      <PopupClicksTable rows={data?.popups ?? null} periodLabel={periodLabel} />
      <EngagedTimeCard data={data?.engagedTime ?? null} periodLabel={periodLabel} />
      <SourcesTable rows={data?.sources ?? []} periodLabel={periodLabel} isLoading={isLoading} />
      <RetentionLoginCards
        retention={data?.retention ?? null}
        login={data?.login ?? null}
        periodLabel={periodLabel}
      />
      <FeatureUsageTable rows={data?.features ?? []} periodLabel={periodLabel} isLoading={isLoading} />
    </div>
  );
}
