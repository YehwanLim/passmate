import { useEffect, useState } from "react";
import { adminApiFetch } from "@/lib/adminApi";
import {
  fetchPremiumSalesSettings,
  updateCompanyAnalysisEnabled,
  updatePremiumSalesEnabled,
} from "@/lib/admin-entitlements";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { ProductSettingsCard } from "@/components/admin/settings/ProductSettingsCard";
import { ServerToggleCard } from "@/components/admin/settings/ServerToggleCard";
import { SettingsMockPanel } from "@/components/admin/settings/SettingsMockPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useServerToggle } from "@/hooks/admin/useServerToggle";

export default function SettingsPage() {
  const [settingsUnavailable, setSettingsUnavailable] = useState(true);

  // 프리미엄 판매·기업 분석 스위치 — 이 화면에서 서버에 실제 반영되는 설정
  const premium = useServerToggle({
    update: async (checked) => (await updatePremiumSalesEnabled(checked)).premiumEnabled,
    failMessage: "결제 판매 상태를 변경하지 못했습니다.",
  });
  const company = useServerToggle({
    update: async (checked) => (await updateCompanyAnalysisEnabled(checked)).companyAnalysisEnabled,
    failMessage: "기업 분석 스위치를 변경하지 못했습니다.",
  });
  const { setEnabled: setPremiumEnabled, setError: setPremiumError } = premium;
  const { setEnabled: setCompanyEnabled } = company;

  useEffect(() => {
    fetchPremiumSalesSettings()
      .then((result) => {
        setPremiumEnabled(result.premiumEnabled);
        setCompanyEnabled(result.companyAnalysisEnabled);
      })
      .catch((error: unknown) =>
        setPremiumError(error instanceof Error ? error.message : "결제 판매 상태를 불러오지 못했습니다."),
      );
  }, [setCompanyEnabled, setPremiumEnabled, setPremiumError]);

  useEffect(() => {
    adminApiFetch<{ available: boolean }>("/api/admin/settings")
      .then((result) => setSettingsUnavailable(!result.available))
      .catch(() => setSettingsUnavailable(true));
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settings"
        description="서비스 주요 변수 및 기능 활성화 플래그를 실시간 제어합니다."
      />

      {settingsUnavailable && (
        <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <AlertTitle className="text-sm font-semibold">Settings are read-only</AlertTitle>
          <AlertDescription className="text-xs">
            서버 설정 스키마가 아직 배포되지 않아 이 화면의 제어는 unavailable 상태입니다.
          </AlertDescription>
        </Alert>
      )}

      {/* 서버에 실제 반영되는 제어 — 읽기 전용 목업 밖에 둔다 */}
      <ServerToggleCard
        title="프리미엄 크레딧 판매"
        description="켜면 구매 버튼과 Groble 결제가 열립니다. 끄면 신규 구매가 차단되고 기구매 크레딧도 숨겨지므로, 결제 발생 후에는 비상시에만 끄세요. 토글 즉시 서버에 반영됩니다."
        statusLabel={
          premium.enabled === null
            ? "판매 상태 불러오는 중..."
            : premium.enabled
              ? "판매 중"
              : "판매 중지됨"
        }
        enabled={premium.enabled}
        busy={premium.busy}
        error={premium.error}
        onToggle={(checked) => void premium.toggle(checked)}
      />

      <ServerToggleCard
        title="기업 분석 리포트"
        description="켜면 일반 사용자가 기업 분석 리포트를 생성할 수 있습니다. 꺼져 있어도 관리자 계정은 생성할 수 있고, 이미 지급된 기업 분석 크레딧 잔액은 그대로 보입니다. 토글 즉시 서버에 반영됩니다."
        statusLabel={company.enabled === null ? "상태 불러오는 중..." : company.enabled ? "열림" : "관리자만"}
        enabled={company.enabled}
        busy={company.busy}
        error={company.error}
        onToggle={(checked) => void company.toggle(checked)}
      />

      <ProductSettingsCard />

      <SettingsMockPanel onChange={() => setSettingsUnavailable(true)} />
    </div>
  );
}
