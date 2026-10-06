import { Check, X, Loader2 } from "lucide-react";
import type { AnalysisStatus } from "@/types/my";

const STATUS_CONFIG: Record<
  AnalysisStatus,
  { label: string; icon: typeof Check; className: string }
> = {
  SUCCESS: {
    label: "분석 완료",
    icon: Check,
    className:
      "bg-ok-soft text-ok border-transparent",
  },
  FAILED: {
    label: "분석 실패",
    icon: X,
    className:
      "bg-danger-soft text-danger border-transparent",
  },
  PENDING: {
    label: "분석 중",
    icon: Loader2,
    className:
      "bg-blank-soft text-blank border-transparent",
  },
};

interface StatusBadgeProps {
  status: AnalysisStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-semibold border ${config.className}`}
    >
      <Icon
        className={`w-3 h-3 ${status === "PENDING" ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}
