import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  BarChart3,
  CheckCircle2,
  Clock3,
  MousePointerClick,
  TrendingDown,
  UsersRound,
} from "lucide-react";

import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { Button } from "@/components/ui/button";
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
import { useFunnelAnalyticsData } from "@/hooks/admin/useFunnelAnalyticsData";
import { cn } from "@/lib/utils";
import {
  ANALYTICS_PERIODS,
  FUNNEL_STAGES,
  formatNumber,
  type PeriodKey,
} from "./funnelAnalytics";

const conversionChartConfig: ChartConfig = {
  conversion: {
    label: "Conversion",
    color: "var(--color-blue-500)",
  },
  completed: {
    label: "Completed",
    color: "var(--color-emerald-500)",
  },
};

// components/admin/dashboard/KpiCard 와 이름이 겹쳐 페이지 전용 이름을 쓴다.
function AnalyticsKpiCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BarChart3;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("7d");
  const { data: analytics, isLoading, error, refresh, lastRefreshed } =
    useFunnelAnalyticsData(selectedPeriod);

  const maxUsers = analytics.funnel[0]?.users ?? 1;
  const largestDropOff = Math.max(
    ...analytics.funnel.map((step) => step.dropOffRate)
  );

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Funnel Analytics"
        description="사용자의 랜딩부터 결제 완료까지 전환율과 이탈 구간을 분석합니다."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminRefreshControl
              lastRefreshed={lastRefreshed}
              isLoading={isLoading}
              onRefresh={refresh}
              buttonClassName="h-9"
            />
            <div className="inline-flex rounded-md border bg-background p-1 shadow-sm">
              {ANALYTICS_PERIODS.map((period) => (
                <Button
                  key={period.key}
                  type="button"
                  variant={selectedPeriod === period.key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period.key)}
                  className="h-8 px-3 text-xs"
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </div>
        }
      />

      <AdminErrorAlert message={error} />

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[124px]" />
            <Skeleton className="h-[124px]" />
            <Skeleton className="h-[124px]" />
          </>
        ) : (
          <>
            <AnalyticsKpiCard
              label="Overall Conversion"
              value={analytics.kpis.overallConversion}
              detail="Landing 대비 Completed 비율"
              icon={CheckCircle2}
            />
            <AnalyticsKpiCard
              label="Avg Completion Time"
              value={analytics.kpis.avgCompletionTime}
              detail="성공 분석의 평균 응답 시간"
              icon={Clock3}
            />
            <AnalyticsKpiCard
              label="Top Drop-off"
              value={analytics.kpis.topDropOff}
              detail="가장 큰 전환 손실 구간"
              icon={TrendingDown}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Conversion Funnel
                </CardTitle>
                <CardDescription className="text-xs">
                  단계별 Users, Conversion Rate, Drop-off Rate
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UsersRound className="size-3.5" />
                {formatNumber(maxUsers)} started
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {FUNNEL_STAGES.map((stage) => (
                  <Skeleton key={stage} className="h-[70px] w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 border-b pb-2 text-xs font-medium text-muted-foreground md:grid">
                  <span>Step</span>
                  <span className="text-right">Users</span>
                  <span className="text-right">Conversion Rate</span>
                  <span className="text-right">Drop-off Rate</span>
                </div>

                <div className="divide-y">
                  {analytics.funnel.map((step, index) => {
                    const width =
                      maxUsers === 0 ? 0 : Math.max((step.users / maxUsers) * 100, 5);
                    const isTopDropOff =
                      largestDropOff > 0 && step.dropOffRate === largestDropOff;

                    return (
                      <div
                        key={step.stage}
                        className="grid gap-3 py-4 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center md:gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                              {index + 1}
                            </span>
                            <span className="truncate text-sm font-medium">
                              {step.stage}
                            </span>
                            {isTopDropOff && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                                Top drop-off
                              </span>
                            )}
                          </div>
                          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                index === analytics.funnel.length - 1
                                  ? "bg-emerald-500"
                                  : "bg-blue-500"
                              )}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>

                        <MetricValue
                          label="Users"
                          value={formatNumber(step.users)}
                        />
                        <MetricValue
                          label="Conversion Rate"
                          value={`${step.conversionRate}%`}
                        />
                        <MetricValue
                          label="Drop-off Rate"
                          value={`${step.dropOffRate}%`}
                          tone={isTopDropOff ? "warning" : "default"}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Conversion Trend
              </CardTitle>
              <CardDescription className="text-xs">
                선택 기간 내 완료 전환율 변화
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[210px] w-full" />
              ) : (
                <ChartContainer
                  config={conversionChartConfig}
                  className="h-[210px] w-full"
                >
                  <LineChart
                    data={analytics.trend}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      className="stroke-border/60"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => `${value}%`}
                      width={36}
                    />
                    <ChartTooltip
                      cursor={{
                        stroke: "var(--border)",
                        strokeDasharray: "4 4",
                      }}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversion"
                      stroke="var(--color-blue-500)"
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Completed Users
              </CardTitle>
              <CardDescription className="text-xs">
                완료 사용자 수 분포
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[180px] w-full" />
              ) : (
                <ChartContainer
                  config={conversionChartConfig}
                  className="h-[180px] w-full"
                >
                  <BarChart
                    data={analytics.trend}
                    margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
                    barSize={28}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      className="stroke-border/60"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                      width={36}
                    />
                    <ChartTooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.45 }}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Bar
                      dataKey="completed"
                      fill="var(--color-emerald-500)"
                      fillOpacity={0.88}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <MousePointerClick className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">Primary insight</p>
              <p className="text-xs text-muted-foreground">
                현재 퍼널은 users, projects, analyses 테이블 기반 proxy입니다.
                별도 결제/랜딩 이벤트가 생기면 같은 화면에서 실제 이벤트 기준으로
                교체할 수 있습니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-rose-700">
            <ArrowDown className="size-3.5" />
            {largestDropOff}% max drop-off
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricValue({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-3 md:block md:text-right">
      <span className="text-xs text-muted-foreground md:hidden">{label}</span>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          tone === "warning" && "text-rose-700"
        )}
      >
        {value}
      </span>
    </div>
  );
}
