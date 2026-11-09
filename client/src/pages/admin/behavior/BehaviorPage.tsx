import { useState } from "react";
import { EngagedTimeCard } from "@/components/admin/behavior/EngagedTimeCard";
import { FeatureUsageTable } from "@/components/admin/behavior/FeatureUsageTable";
import { FunnelTable } from "@/components/admin/behavior/FunnelTable";
import { InterviewStatsCard } from "@/components/admin/behavior/InterviewStatsCard";
import { PopupClicksTable } from "@/components/admin/behavior/PopupClicksTable";
import { RetentionLoginCards } from "@/components/admin/behavior/RetentionLoginCards";
import { SourcesTable } from "@/components/admin/behavior/SourcesTable";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminPeriodPicker } from "@/components/admin/shared/AdminPeriodPicker";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { useBehaviorData } from "@/hooks/admin/useBehaviorData";
import { adminDateRangeLabel, adminPeriodLabel, type AdminDateRange, type AdminPeriod } from "@/lib/adminPeriod";

/**
 * BehaviorPage — 사람들이 어디서 와서 어디까지 가고, 다시 오는지.
 * 전부 실제 기록(site_visits·client_events·DB)으로 센다. 운영자 계정 사용은 서버가 뺀다.
 */
export default function BehaviorPage() {
  const [period, setPeriod] = useState<AdminPeriod>("7d");
  // null 이면 기간 버튼, 있으면 '날짜 지정'(하루만 고르면 일자별로 본다)
  const [range, setRange] = useState<AdminDateRange | null>(null);
  const { data, isLoading, error, refresh, lastRefreshed } = useBehaviorData(period, range);
  const periodLabel = range ? adminDateRangeLabel(range) : adminPeriodLabel(period);
  const choosePeriod = (next: AdminPeriod) => {
    setRange(null);
    setPeriod(next);
  };

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="사용 행동"
        description="어디서 와서, 어디까지 가고, 다시 오는지."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPeriodPicker
              value={period}
              onChange={choosePeriod}
              idPrefix="behavior"
              custom={{ range, onRangeChange: setRange }}
            />
            <AdminRefreshControl lastRefreshed={lastRefreshed} isLoading={isLoading} onRefresh={refresh} id="behavior-refresh-btn" />
          </div>
        }
      />

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
