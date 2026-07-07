import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";

export default function AnalyticsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Analytics"
        description="사용자 행동 및 서비스 트래픽을 분석합니다."
      />
      {/* TODO: GA4 연동 또는 Recharts 기반 차트 */}
    </div>
  );
}
