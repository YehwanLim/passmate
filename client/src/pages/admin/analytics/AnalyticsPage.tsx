import { useCallback, useEffect, useState } from "react";
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
  AlertCircle,
  CheckCircle2,
  Clock3,
  MousePointerClick,
  RefreshCw,
  TrendingDown,
  UsersRound,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { cn } from "@/lib/utils";

export const ANALYTICS_PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
] as const;

export const FUNNEL_STAGES = [
  "Landing",
  "Login",
  "Resume Upload",
  "AI Analysis",
  "Payment",
  "Completed",
] as const;

export type PeriodKey = (typeof ANALYTICS_PERIODS)[number]["key"];
type FunnelStage = (typeof FUNNEL_STAGES)[number];
type AnalysisStatus = "PENDING" | "SUCCESS" | "FAILED";

interface FunnelStep {
  stage: FunnelStage;
  users: number;
  conversionRate: number;
  dropOffRate: number;
}

interface AnalyticsTrendPoint {
  label: string;
  conversion: number;
  completed: number;
}

interface FunnelAnalytics {
  kpis: {
    overallConversion: string;
    avgCompletionTime: string;
    topDropOff: string;
  };
  funnel: FunnelStep[];
  trend: AnalyticsTrendPoint[];
}

interface SourceAnalysis {
  created_at: string;
  status: AnalysisStatus;
}

interface FunnelAnalyticsSource {
  signedUpUsers: number;
  resumeUploadUsers: number;
  analysisUsers: number;
  successUsers: number;
  avgCompletionMs: number;
  analyses: SourceAnalysis[];
  now?: Date;
}

interface AsyncState<T> {
  data: T;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_SOURCE: FunnelAnalyticsSource = {
  signedUpUsers: 0,
  resumeUploadUsers: 0,
  analysisUsers: 0,
  successUsers: 0,
  avgCompletionMs: 0,
  analyses: [],
};

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

export function getFunnelAnalytics(period: PeriodKey): FunnelAnalytics {
  return buildFunnelAnalytics(period, EMPTY_SOURCE);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function roundRate(value: number) {
  return Math.round(value * 10) / 10;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s";

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function getPeriodStart(period: PeriodKey, now = new Date()) {
  const start = new Date(now);

  if (period === "today") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(start.getDate() - (period === "7d" ? 6 : 29));
  start.setHours(0, 0, 0, 0);
  return start;
}

function getTrendLabels(period: PeriodKey, now = new Date()) {
  if (period === "today") {
    return Array.from({ length: 6 }, (_, index) =>
      String(index * 4).padStart(2, "0")
    );
  }

  const dayCount = period === "7d" ? 7 : 30;
  return Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(now);
    day.setDate(day.getDate() - (dayCount - 1 - index));
    return `${String(day.getMonth() + 1).padStart(2, "0")}/${String(
      day.getDate()
    ).padStart(2, "0")}`;
  });
}

function getTrendLabel(date: Date, period: PeriodKey) {
  if (period === "today") {
    const bucket = Math.floor(date.getHours() / 4) * 4;
    return String(bucket).padStart(2, "0");
  }

  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function uniqueCount(rows: Array<{ user_id: string | null }>) {
  return new Set(rows.map((row) => row.user_id).filter(Boolean)).size;
}

export function buildFunnelAnalytics(
  period: PeriodKey,
  source: FunnelAnalyticsSource
): FunnelAnalytics {
  const now = source.now ?? new Date();
  const startedUsers = Math.max(
    source.signedUpUsers,
    source.resumeUploadUsers,
    source.analysisUsers,
    source.successUsers
  );
  const stageUsers = [
    startedUsers,
    startedUsers,
    Math.min(source.resumeUploadUsers, startedUsers),
    Math.min(source.analysisUsers, startedUsers),
    Math.min(source.analysisUsers, startedUsers),
    Math.min(source.successUsers, startedUsers),
  ];

  const funnel = FUNNEL_STAGES.map((stage, index) => {
    const previousUsers = index === 0 ? stageUsers[0] : stageUsers[index - 1];
    const users = stageUsers[index];
    const conversionRate =
      startedUsers === 0 ? 0 : roundRate((users / startedUsers) * 100);
    const dropOffRate =
      index === 0 || previousUsers === 0
        ? 0
        : roundRate(((previousUsers - users) / previousUsers) * 100);

    return {
      stage,
      users,
      conversionRate,
      dropOffRate,
    };
  });

  const topDropOff = funnel
    .slice(1)
    .reduce(
      (top, step, index) =>
        step.dropOffRate > top.rate
          ? {
              rate: step.dropOffRate,
              label: `${FUNNEL_STAGES[index]} -> ${step.stage}`,
            }
          : top,
      { rate: 0, label: "No drop-off" }
    );

  const trendStats = new Map<
    string,
    { total: number; completed: number }
  >();
  getTrendLabels(period, now).forEach((label) => {
    trendStats.set(label, { total: 0, completed: 0 });
  });

  source.analyses.forEach((analysis) => {
    const label = getTrendLabel(new Date(analysis.created_at), period);
    const bucket = trendStats.get(label);
    if (!bucket) return;

    bucket.total += 1;
    if (analysis.status === "SUCCESS") {
      bucket.completed += 1;
    }
  });

  const trend = Array.from(trendStats.entries()).map(([label, stats]) => ({
    label,
    conversion:
      stats.total === 0 ? 0 : roundRate((stats.completed / stats.total) * 100),
    completed: stats.completed,
  }));

  const completedUsers = funnel.at(-1)?.users ?? 0;

  return {
    kpis: {
      overallConversion: formatPercent(
        startedUsers === 0 ? 0 : roundRate((completedUsers / startedUsers) * 100)
      ),
      avgCompletionTime: formatDuration(source.avgCompletionMs),
      topDropOff: topDropOff.label,
    },
    funnel,
    trend,
  };
}

function useFunnelAnalyticsData(period: PeriodKey) {
  const [state, setState] = useState<AsyncState<FunnelAnalytics>>({
    data: getFunnelAnalytics(period),
    isLoading: true,
    error: null,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchAnalytics = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const periodStart = getPeriodStart(period).toISOString();

      try {
        const [usersRes, projectsRes, analysesRes] = await Promise.all([
          supabase
            .from("users")
            .select("id", { count: "exact", head: true })
            .gte("created_at", periodStart),
          supabase
            .from("projects")
            .select("user_id")
            .gte("created_at", periodStart),
          supabase
            .from("analyses")
            .select("user_id, status, response_time_ms, created_at")
            .gte("created_at", periodStart)
            .order("created_at", { ascending: true }),
        ]);

        const queryError = usersRes.error ?? projectsRes.error ?? analysesRes.error;
        if (queryError) {
          throw queryError;
        }

        const projectRows = (projectsRes.data ?? []) as Array<{
          user_id: string | null;
        }>;
        const analysisRows = (analysesRes.data ?? []) as Array<{
          user_id: string | null;
          status: AnalysisStatus;
          response_time_ms: number | null;
          created_at: string;
        }>;
        const successRows = analysisRows.filter(
          (row) => row.status === "SUCCESS"
        );
        const successfulDurations = successRows
          .map((row) => row.response_time_ms)
          .filter(
            (value): value is number =>
              typeof value === "number" && Number.isFinite(value) && value > 0
          );
        const avgCompletionMs =
          successfulDurations.length === 0
            ? 0
            : successfulDurations.reduce((sum, value) => sum + value, 0) /
              successfulDurations.length;

        const analytics = buildFunnelAnalytics(period, {
          signedUpUsers: usersRes.count ?? 0,
          resumeUploadUsers: uniqueCount(projectRows),
          analysisUsers: uniqueCount(analysisRows),
          successUsers: uniqueCount(successRows),
          avgCompletionMs,
          analyses: analysisRows.map((row) => ({
            created_at: row.created_at,
            status: row.status,
          })),
        });

        if (cancelled) return;
        setState({ data: analytics, isLoading: false, error: null });
        setLastRefreshed(new Date());
      } catch (err) {
        if (cancelled) return;
        setState({
          data: getFunnelAnalytics(period),
          isLoading: false,
          error:
            err instanceof Error
              ? err.message
              : "퍼널 데이터를 불러오지 못했습니다.",
        });
      }
    };

    fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, [period, tick]);

  return { ...state, refresh, lastRefreshed };
}

function KpiCard({
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
  const refreshLabel = lastRefreshed
    ? `${lastRefreshed.getHours().toString().padStart(2, "0")}:${lastRefreshed
        .getMinutes()
        .toString()
        .padStart(2, "0")} 갱신`
    : "";

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Funnel Analytics"
        description="사용자의 랜딩부터 결제 완료까지 전환율과 이탈 구간을 분석합니다."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {refreshLabel && (
              <span className="hidden text-xs text-muted-foreground sm:block">
                {refreshLabel}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="h-9 gap-1.5"
            >
              <RefreshCw
                className={cn("size-3.5", isLoading && "animate-spin")}
              />
              새로고침
            </Button>
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

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[124px]" />
            <Skeleton className="h-[124px]" />
            <Skeleton className="h-[124px]" />
          </>
        ) : (
          <>
            <KpiCard
              label="Overall Conversion"
              value={analytics.kpis.overallConversion}
              detail="Landing 대비 Completed 비율"
              icon={CheckCircle2}
            />
            <KpiCard
              label="Avg Completion Time"
              value={analytics.kpis.avgCompletionTime}
              detail="성공 분석의 평균 응답 시간"
              icon={Clock3}
            />
            <KpiCard
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
