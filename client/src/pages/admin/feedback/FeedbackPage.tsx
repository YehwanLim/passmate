import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";

export default function FeedbackPage() {
  return (
    <div>
      <AdminPageHeader
        title="Feedback"
        description="사용자 피드백 및 문의를 확인합니다."
      />
      {/* TODO: 피드백 목록 + 상태 관리 */}
    </div>
  );
}
