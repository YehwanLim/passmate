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
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  FAILED: {
    label: "분석 실패",
    icon: X,
    className:
      "bg-red-500/10 text-red-400 border-red-500/20",
  },
  PENDING: {
    label: "분석 중",
    icon: Loader2,
    className:
      "bg-amber-500/10 text-amber-400 border-amber-500/20",
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
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${config.className}`}
    >
      <Icon
        className={`w-3 h-3 ${status === "PENDING" ? "animate-spin" : ""}`}
      />
      {config.label}
    </span>
  );
}
