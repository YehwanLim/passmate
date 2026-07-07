import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { HourlyUsagePoint, DailyUsagePoint } from "@/hooks/admin/useAiUsageData";

// ============================================================
// 차트 설정
// ============================================================

const tokenChartConfig: ChartConfig = {
  tokens: {
    label: "토큰 사용량",
    color: "var(--color-blue-500)",
  },
};

const costChartConfig: ChartConfig = {
  cost: {
    label: "사용 비용 (USD)",
    color: "var(--color-emerald-500)",
  },
};

interface UsageChartsSectionProps {
  hourlyData: HourlyUsagePoint[];
  dailyData: DailyUsagePoint[];
  isLoading: boolean;
}

export function UsageChartsSection({
  hourlyData,
  dailyData,
  isLoading,
}: UsageChartsSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. 시간대별 사용량 (오늘) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">시간대별 트렌드</CardTitle>
              <CardDescription className="text-xs">오늘 00시 ~ 현재 (KST)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tokens" className="w-full">
            <div className="flex justify-end mb-2">
              <TabsList className="grid grid-cols-2 h-7 w-[120px] p-0.5">
                <TabsTrigger value="tokens" className="text-[10px] h-6 py-0">
                  토큰
                </TabsTrigger>
                <TabsTrigger value="cost" className="text-[10px] h-6 py-0">
                  비용
                </TabsTrigger>
              </TabsList>
            </div>

            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <>
                <TabsContent value="tokens" className="mt-0">
                  <ChartContainer config={tokenChartConfig} className="h-[200px] w-full">
                    <AreaChart
                      data={hourlyData}
                      margin={{ top: 5, right: 5, left: -24, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="hourlyTokenFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-blue-500)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--color-blue-500)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickMargin={4} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={36} />
                      <ChartTooltip
                        cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                        content={<ChartTooltipContent indicator="line" labelFormatter={(label) => `${label} 사용량`} />}
                      />
                      <Area
                        type="monotone"
                        dataKey="tokens"
                        stroke="var(--color-blue-500)"
                        strokeWidth={1.5}
                        fill="url(#hourlyTokenFill)"
                        dot={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </TabsContent>

                <TabsContent value="cost" className="mt-0">
                  <ChartContainer config={costChartConfig} className="h-[200px] w-full">
                    <AreaChart
                      data={hourlyData}
                      margin={{ top: 5, right: 5, left: -24, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="hourlyCostFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-emerald-500)" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="var(--color-emerald-500)" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickMargin={4} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={36} />
                      <ChartTooltip
                        cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                        content={
                          <ChartTooltipContent
                            indicator="line"
                            labelFormatter={(label) => `${label} 비용`}
                            formatter={(val) => `$${Number(val).toFixed(4)}`}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="cost"
                        stroke="var(--color-emerald-500)"
                        strokeWidth={1.5}
                        fill="url(#hourlyCostFill)"
                        dot={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* 2. 일별 사용량 (최근 7일) */}
      <Card>
        <CardHeader className="pb-2">
          <div>
            <CardTitle className="text-sm font-semibold">일별 트렌드</CardTitle>
            <CardDescription className="text-xs">최근 7일간의 리소스 사용 흐름</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tokens" className="w-full">
            <div className="flex justify-end mb-2">
              <TabsList className="grid grid-cols-2 h-7 w-[120px] p-0.5">
                <TabsTrigger value="tokens" className="text-[10px] h-6 py-0">
                  토큰
                </TabsTrigger>
                <TabsTrigger value="cost" className="text-[10px] h-6 py-0">
                  비용
                </TabsTrigger>
              </TabsList>
            </div>

            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <>
                <TabsContent value="tokens" className="mt-0">
                  <ChartContainer config={tokenChartConfig} className="h-[200px] w-full">
                    <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }} barSize={20}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickMargin={4} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={36} />
                      <ChartTooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                        content={<ChartTooltipContent indicator="dot" labelFormatter={(label) => `${label} 사용`} />}
                      />
                      <Bar dataKey="tokens" fill="var(--color-blue-500)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </TabsContent>

                <TabsContent value="cost" className="mt-0">
                  <ChartContainer config={costChartConfig} className="h-[200px] w-full">
                    <BarChart data={dailyData} margin={{ top: 5, right: 5, left: -24, bottom: 0 }} barSize={20}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} tickMargin={4} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={36} />
                      <ChartTooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                        content={
                          <ChartTooltipContent
                            indicator="dot"
                            labelFormatter={(label) => `${label} 비용`}
                            formatter={(val) => `$${Number(val).toFixed(4)}`}
                          />
                        }
                      />
                      <Bar dataKey="cost" fill="var(--color-emerald-500)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </TabsContent>
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
