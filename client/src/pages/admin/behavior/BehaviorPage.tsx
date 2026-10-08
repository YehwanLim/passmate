import { useState } from "react";
import { FeatureUsageTable } from "@/components/admin/behavior/FeatureUsageTable";
import { FunnelTable } from "@/components/admin/behavior/FunnelTable";
import { RetentionLoginCards } from "@/components/admin/behavior/RetentionLoginCards";
import { SourcesTable } from "@/components/admin/behavior/SourcesTable";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminPeriodPicker } from "@/components/admin/shared/AdminPeriodPicker";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { useBehaviorData } from "@/hooks/admin/useBehaviorData";
import { adminPeriodLabel, type AdminPeriod } from "@/lib/adminPeriod";

/**
 * BehaviorPage — 사람들이 어디서 와서 어디까지 가고, 다시 오는지.
 * 전부 실제 기록(site_visits·client_events·DB)으로 센다. 운영자 계정 사용은 서버가 뺀다.
 */
export default function BehaviorPage() {
  const [period, setPeriod] = useState<AdminPeriod>("7d");
  const { data, isLoading, error, refresh, lastRefreshed } = useBehaviorData(period);
  const periodLabel = adminPeriodLabel(period);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="사용 행동"
        description="어디서 와서, 어디까지 가고, 다시 오는지."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminPeriodPicker value={period} onChange={setPeriod} idPrefix="behavior" />
            <AdminRefreshControl lastRefreshed={lastRefreshed} isLoading={isLoading} onRefresh={refresh} id="behavior-refresh-btn" />
          </div>
        }
      />

      <AdminErrorAlert message={error} />

      <FunnelTable steps={data?.funnel ?? []} periodLabel={periodLabel} isLoading={isLoading} />
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
