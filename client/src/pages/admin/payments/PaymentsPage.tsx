import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";

export default function PaymentsPage() {
  return (
    <div>
      <AdminPageHeader
        title="Payments"
        description="결제 내역 및 구독 현황을 관리합니다."
      />
      {/* TODO: 결제 내역 테이블 */}
    </div>
  );
}
