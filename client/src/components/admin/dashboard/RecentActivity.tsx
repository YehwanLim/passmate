import { CheckCircle2, XCircle, Clock, Bot } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/hooks/admin/useDashboardData";

// ============================================================
// 상태별 아이콘 + 색상
// ============================================================

const STATUS_CONFIG = {
  SUCCESS: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    label: "완료",
  },
  FAILED: {
    icon: XCircle,
    color: "text-destructive",
    label: "실패",
  },
  PENDING: {
    icon: Clock,
    color: "text-amber-500",
    label: "처리중",
  },
} as const;

// ============================================================
// 유틸
// ============================================================

/** "방금 전", "5분 전", "2시간 전" 등 상대 시간 포맷 */
function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/** 이메일에서 @ 앞 부분만 표시 (개인정보 최소화) */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const masked =
    local.length > 4
      ? `${local.slice(0, 3)}${"*".repeat(local.length - 3)}`
      : `${local[0]}${"*".repeat(local.length - 1)}`;
  return `${masked}@${domain}`;
}

// ============================================================
// Component
// ============================================================

interface RecentActivityProps {
  data: ActivityItem[];
  isLoading: boolean;
}

/**
 * RecentActivity
 *
 * 최근 10건의 이력서 분석 활동을 피드 형태로 표시합니다.
 *
 * UX 결정 사항:
 * - 이메일은 부분 마스킹 (개인정보 최소화)
 * - 상대 시간 표시로 운영자가 "언제" 인지 직관적으로 파악
 * - 상태별 색상 + 아이콘으로 SUCCESS/FAILED/PENDING 구분
 * - 모델명이 있으면 표시 (어떤 AI 모델이 사용됐는지 확인 가능)
 */
export function RecentActivity({ data, isLoading }: RecentActivityProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">최근 활동</CardTitle>
        <CardDescription className="text-xs">
          최근 분석 요청 10건
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-5 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bot className="size-8 mb-2 opacity-30" />
            <p className="text-sm">최근 활동이 없습니다.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {data.map((item) => {
              const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.PENDING;
              const StatusIcon = cfg.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  {/* 상태 아이콘 */}
                  <StatusIcon
                    className={cn("size-4 flex-shrink-0", cfg.color)}
                  />

                  {/* 이메일 + 모델 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">
                      {maskEmail(item.userEmail)}
                    </p>
                    {item.modelName && (
                      <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                        {item.modelName}
                      </p>
                    )}
                  </div>

                  {/* 상태 뱃지 + 시간 */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide",
                        cfg.color
                      )}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
