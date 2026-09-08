import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { VisitorChartPoint } from "@/hooks/admin/useDashboardData";

const chartConfig: ChartConfig = {
  visitors: {
    label: "방문자",
    color: "var(--color-emerald-500)",
  },
  pageViews: {
    label: "페이지뷰",
    color: "var(--color-slate-400)",
  },
};

interface VisitorChartProps {
  data: VisitorChartPoint[];
  days: number;
  isLoading: boolean;
}

/**
 * VisitorChart
 *
 * 일별 고유 방문자(세션 기준)와 페이지뷰 추이. 분석 여부와 상관없이
 * 사이트에 들어온 방문이 모두 잡히므로 가입·분석 차트의 "분모"에 해당한다.
 */
export function VisitorChart({ data, days, isLoading }: VisitorChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">방문 추이</CardTitle>
        <CardDescription className="text-xs">최근 {days}일 · 방문자는 탭 세션 기준</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="visitorFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-emerald-500)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-emerald-500)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={6}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={<ChartTooltipContent indicator="line" />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="pageViews"
                stroke="var(--color-slate-400)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="transparent"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="visitors"
                stroke="var(--color-emerald-500)"
                strokeWidth={2}
                fill="url(#visitorFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
