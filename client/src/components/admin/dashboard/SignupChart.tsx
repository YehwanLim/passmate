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
    label: "신규 가입",
    color: "var(--color-blue-500)",
  },
};

interface SignupChartProps {
  data: ChartPoint[];
  isLoading: boolean;
}

/**
 * SignupChart
 *
 * 최근 7일 신규 가입자 추이 — Area Chart.
 * Area fill로 볼륨감을 강조하여 트렌드를 직관적으로 파악할 수 있습니다.
 */
export function SignupChart({ data, isLoading }: SignupChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">신규 가입 추이</CardTitle>
        <CardDescription className="text-xs">최근 7일</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[180px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
            >
              <defs>
                <linearGradient id="signupFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-blue-500)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-blue-500)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
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
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    labelFormatter={(label) => `${label} 가입자`}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-blue-500)"
                strokeWidth={2}
                fill="url(#signupFill)"
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
