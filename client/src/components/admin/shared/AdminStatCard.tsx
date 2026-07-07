import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface AdminStatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  /** 전 기간 대비 변화 표시 예: "+12.5%" */
  trend?: string;
  /** trend가 긍정적이면 true, 부정적이면 false */
  trendPositive?: boolean;
  className?: string;
}

/**
 * AdminStatCard
 *
 * 대시보드 상단 KPI 통계 카드.
 * shadcn Card 기반으로 아이콘, 수치, 설명, 트렌드를 표시합니다.
 *
 * @example
 * <AdminStatCard
 *   title="총 사용자"
 *   value="1,234"
 *   description="전체 가입자 수"
 *   icon={Users}
 *   trend="+5.2%"
 *   trendPositive
 * />
 */
export function AdminStatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  trendPositive,
  className,
}: AdminStatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <span
                className={cn(
                  "text-xs font-medium",
                  trendPositive ? "text-emerald-600" : "text-destructive"
                )}
              >
                {trend}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
