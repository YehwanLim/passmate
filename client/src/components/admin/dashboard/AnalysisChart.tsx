import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartPoint } from "@/hooks/admin/useDashboardData";

// ============================================================
// Chart config
// ============================================================

const chartConfig: ChartConfig = {
  count: {
    label: "분석 건수",
    color: "var(--color-indigo-500)",
  },
};

interface AnalysisChartProps {
  data: ChartPoint[];
  isLoading: boolean;
}

/**
 * AnalysisChart
 *
 * 최근 7일 이력서 분석 건수 — Bar Chart.
 * 일별 이산 데이터이므로 Area보다 Bar가 적합합니다.
 * 가입 차트와 색상을 다르게 하여 시각적으로 구분합니다.
 */
export function AnalysisChart({ data, isLoading }: AnalysisChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">분석 건수 추이</CardTitle>
        <CardDescription className="text-xs">최근 7일</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              barSize={28}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                className="stroke-border/50"
              />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickMargin={6}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                allowDecimals={false}
                width={32}
              />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label) => `${label} 분석`}
                  />
                }
              />
              <Bar
                dataKey="count"
                fill="var(--color-indigo-500)"
                radius={[4, 4, 0, 0]}
                fillOpacity={0.85}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
