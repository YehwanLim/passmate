import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================
// 타입
// ============================================================

export interface KpiCardProps {
  title: string;
  value: string | number | null;
  /** 카드 아래 보조 설명 */
  description?: string;
  icon: LucideIcon;
  /** 전일 대비 수치. 양수면 상승, 음수면 하락 */
  delta?: number | null;
  /** delta 방향이 서비스에 긍정적인지. 기본 true (증가=긍정) */
  positiveIsGood?: boolean;
  /** 데이터 없음 표시 (payments 등 미구현 기능) */
  unavailable?: boolean;
  /** 로딩 상태 */
  isLoading?: boolean;
  /** 카드 배경 강조 색상 변형 */
  variant?: "default" | "highlight";
  className?: string;
}

// ============================================================
// 포맷 유틸리티
// ============================================================

function formatValue(val: string | number | null): string {
  if (val === null || val === undefined) return "–";
  if (typeof val === "number") return val.toLocaleString("ko-KR");
  return val;
}

function formatDelta(delta: number): string {
  const abs = Math.abs(delta);
  const prefix = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${prefix}${abs.toLocaleString("ko-KR")}`;
}

// ============================================================
// Component
// ============================================================

/**
 * KpiCard
 *
 * 대시보드 KPI 카드. AdminStatCard보다 기능이 풍부합니다:
 * - Skeleton 로딩 상태
 * - 전일 대비 delta (TrendingUp/TrendingDown 아이콘)
 * - positiveIsGood 플래그 (비용 감소 = 긍정 등 역방향 처리)
 * - unavailable 플래그 (구현 예정 기능 placeholder)
 * - highlight 변형 (온라인 유저 등 실시간 데이터 강조)
 */
export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  delta,
  positiveIsGood = true,
  unavailable = false,
  isLoading = false,
  variant = "default",
  className,
}: KpiCardProps) {
  const isPositiveDelta = delta !== undefined && delta !== null && delta > 0;
  const isNegativeDelta = delta !== undefined && delta !== null && delta < 0;
  const isNeutralDelta = delta !== undefined && delta !== null && delta === 0;

  // delta가 긍정적인지 = (증가 && 증가가 좋음) || (감소 && 감소가 좋음)
  const isDeltaGood =
    (isPositiveDelta && positiveIsGood) ||
    (isNegativeDelta && !positiveIsGood);

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-shadow hover:shadow-md",
        variant === "highlight" &&
          "border-primary/30 bg-primary/[0.03]",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div
          className={cn(
            "flex items-center justify-center size-8 rounded-lg",
            variant === "highlight"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </div>
      </CardHeader>

      <CardContent>
        {/* 메인 수치 */}
        {isLoading ? (
          <Skeleton className="h-8 w-24 mb-2" />
        ) : unavailable ? (
          <div className="text-2xl font-bold text-muted-foreground/50">–</div>
        ) : (
          <div className="text-2xl font-bold tabular-nums">
            {formatValue(value)}
          </div>
        )}

        {/* 하단 메타 (delta + description) */}
        <div className="mt-1.5 flex items-center gap-2 min-h-[18px]">
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : unavailable ? (
            <span className="text-[11px] text-muted-foreground/50">
              준비 중
            </span>
          ) : (
            <>
              {/* delta 표시 */}
              {delta !== null && delta !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    isDeltaGood
                      ? "text-emerald-600"
                      : isNeutralDelta
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
                >
                  {isPositiveDelta && <TrendingUp className="size-3" />}
                  {isNegativeDelta && <TrendingDown className="size-3" />}
                  {isNeutralDelta && <Minus className="size-3" />}
                  {formatDelta(delta)} 전일 대비
                </span>
              )}

              {/* 설명 */}
              {description && (
                <span className="text-xs text-muted-foreground truncate">
                  {description}
                </span>
              )}
            </>
          )}
        </div>
      </CardContent>

      {/* highlight 변형: 좌측 강조 바 */}
      {variant === "highlight" && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-l-lg" />
      )}
    </Card>
  );
}
