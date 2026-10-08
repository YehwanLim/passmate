import { useEffect } from "react";
import {
  fetchPremiumSalesSettings,
  updateCompanyAnalysisEnabled,
  updatePremiumSalesEnabled,
} from "@/lib/admin-entitlements";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { ProductSettingsCard } from "@/components/admin/settings/ProductSettingsCard";
import { ServerToggleCard } from "@/components/admin/settings/ServerToggleCard";
import { useServerToggle } from "@/hooks/admin/useServerToggle";

export default function SettingsPage() {
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="설정"
        description="판매 켜기·끄기와 상품별 결제 링크. 바꾸면 바로 서버에 반영됩니다."
      />

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

    </div>
  );
}
