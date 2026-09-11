// 퍼널 분석 순수 모델. 화면(AnalyticsPage)과 훅(useFunnelAnalyticsData)이 함께 쓴다.

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
export type AnalysisStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface FunnelStep {
  stage: FunnelStage;
  users: number;
  conversionRate: number;
  dropOffRate: number;
}

export interface AnalyticsTrendPoint {
  label: string;
  conversion: number;
  completed: number;
}

export interface FunnelAnalytics {
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

export interface FunnelAnalyticsSource {
  signedUpUsers: number;
  resumeUploadUsers: number;
  analysisUsers: number;
  successUsers: number;
  avgCompletionMs: number;
  analyses: SourceAnalysis[];
  now?: Date;
}

/** GET /api/admin/usage?view=funnel 응답 모양. */
export interface FunnelUsagePayload {
  signedUpUsers: number;
  projects: Array<{ user_id: string | null }>;
  analyses: Array<{
    user_id: string | null;
    status: AnalysisStatus;
    response_time_ms: number | null;
    created_at: string;
  }>;
}

const EMPTY_SOURCE: FunnelAnalyticsSource = {
  signedUpUsers: 0,
  resumeUploadUsers: 0,
  analysisUsers: 0,
  successUsers: 0,
  avgCompletionMs: 0,
  analyses: [],
};

export function getFunnelAnalytics(period: PeriodKey): FunnelAnalytics {
  return buildFunnelAnalytics(period, EMPTY_SOURCE);
}

export function formatNumber(value: number) {
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

/** 서버 usage 응답(원시 행)을 퍼널 집계 입력으로 바꿔 buildFunnelAnalytics 에 넘긴다. */
export function buildFunnelAnalyticsFromUsage(
  period: PeriodKey,
  source: FunnelUsagePayload
): FunnelAnalytics {
  const projectRows = source.projects;
  const analysisRows = source.analyses;
  const successRows = analysisRows.filter((row) => row.status === "SUCCESS");
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

  return buildFunnelAnalytics(period, {
    signedUpUsers: source.signedUpUsers,
    resumeUploadUsers: uniqueCount(projectRows),
    analysisUsers: uniqueCount(analysisRows),
    successUsers: uniqueCount(successRows),
    avgCompletionMs,
    analyses: analysisRows.map((row) => ({
      created_at: row.created_at,
      status: row.status,
    })),
  });
}
