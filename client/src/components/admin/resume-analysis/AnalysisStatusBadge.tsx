import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

type Status = "SUCCESS" | "FAILED" | "PENDING";

const CONFIG: Record<
  Status,
  { icon: React.ElementType; label: string; className: string }
> = {
  SUCCESS: {
    icon: CheckCircle2,
    label: "완료",
    className:
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  FAILED: {
    icon: XCircle,
    label: "실패",
    className:
      "bg-destructive/10 text-destructive border-destructive/20",
  },
  PENDING: {
    icon: Clock,
    label: "대기",
    className:
      "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
};

interface AnalysisStatusBadgeProps {
  status: Status;
  errorCode?: string | null;
  className?: string;
}

export function AnalysisStatusBadge({
  status,
  errorCode,
  className,
}: AnalysisStatusBadgeProps) {
  const cfg = CONFIG[status] ?? CONFIG.PENDING;
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap",
        cfg.className,
        className
      )}
      title={errorCode ?? undefined}
    >
      <Icon className="size-3 flex-shrink-0" />
      {cfg.label}
      {status === "FAILED" && errorCode && (
        <span className="opacity-70 font-normal">({errorCode})</span>
      )}
    </span>
  );
}
