import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/** 관리자 화면 공통 오류 띠. 메시지가 없으면 아무것도 그리지 않는다. */
export function AdminErrorAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null;

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
