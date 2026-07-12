import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";

import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

type ModelStatus = "connected" | "error" | "disabled";
type HealthStatus = "healthy" | "slow" | "error";

interface AiModel {
  id: string;
  provider: string;
  providerKey: string;
  modelName: string;
  status: ModelStatus;
  health: HealthStatus;
  lastChecked: string | null;
  avgResponseTimeMs: number;
  totalRequests: number;
  errorRate: number;
  estimatedCost: number;
  apiKeyMasked: string;
  baseUrl: string;
  maxTokens: number | null;
  temperature: number | null;
  timeoutMs: number;
  enabled: boolean;
  isDefault: boolean;
  isActive: boolean;
  recommendationLabel?: string | null;
  recommendationReason?: string | null;
  recommendationRank?: number;
  inputPricePerMillion?: number | null;
  outputPricePerMillion?: number | null;
  estimatedCostPerCall?: number | null;
}

interface CallLog {
  id: string;
  time: string;
  modelId: string;
  modelName: string;
  provider: string;
  responseTimeMs: number | null;
  tokens: number;
  cost: number;
  success: boolean;
  errorMessage: string | null;
}

interface AiModelsData {
  summary: {
    connectedModels: number;
    totalModels: number;
    defaultModelId: string | null;
    defaultModelName: string | null;
    fallbackModelId: string | null;
    fallbackModelName: string | null;
    todaysRequests: number;
    avgLatencyMs: number;
    todaysEstimatedCost: number;
    errorRate: number;
  };
  models: AiModel[];
  logs: CallLog[];
}

interface TestResult {
  status: "success" | "failed";
  responseTimeMs: number;
  message: string;
}

interface ProviderConfig {
  providerKey: string;
  provider: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
}

interface ConfiguredModel {
  providerKey: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  source: string;
}

interface AvailableModel extends ConfiguredModel {
  displayName?: string;
  description?: string;
  inputTokenLimit?: number | null;
  outputTokenLimit?: number | null;
}

const statusCopy: Record<ModelStatus, string> = {
  connected: "Connected",
  error: "Error",
  disabled: "Disabled",
};

const healthCopy: Record<HealthStatus, string> = {
  healthy: "정상",
  slow: "느림",
  error: "오류",
};

const ESTIMATE_INPUT_TOKENS = 6000;
const ESTIMATE_OUTPUT_TOKENS = 3000;

const RECOMMENDED_MODELS: Record<string, {
  label: string;
  reason: string;
  rank: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
}> = {
  "gemini-2.5-flash-lite": {
    label: "기본 추천",
    reason: "가성비와 속도가 좋아 대량 자기소개서 분석 기본값으로 적합",
    rank: 1,
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
  },
  "gemini-2.5-flash": {
    label: "품질 균형",
    reason: "비용은 조금 오르지만 피드백 품질과 안정성이 더 필요한 요청에 적합",
    rank: 2,
    inputPricePerMillion: 0.3,
    outputPricePerMillion: 2.5,
  },
  "gemini-2.5-pro": {
    label: "고품질",
    reason: "중요 분석이나 까다로운 문항의 고품질 검토용으로 적합",
    rank: 3,
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 10,
  },
  "gpt-5.4-nano": {
    label: "OpenAI 최저가",
    reason: "런칭 전 실제 호출 흐름과 리포트 품질을 최소 비용으로 확인할 때 사용",
    rank: 4,
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 1.25,
  },
  "gpt-5.4-mini": {
    label: "OpenAI 저가",
    reason: "nano보다 조금 더 나은 품질을 저렴하게 비교할 때 사용",
    rank: 5,
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 4.5,
  },
  "gpt-5.6-luna": {
    label: "OpenAI 품질 비교",
    reason: "OpenAI 계열에서 품질 기준선을 보고 싶을 때 사용",
    rank: 6,
    inputPricePerMillion: 1,
    outputPricePerMillion: 6,
  },
};

function formatMs(value: number | null | undefined) {
  if (!value) return "–";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${value}ms`;
}

function estimateCallCost(inputPricePerMillion?: number | null, outputPricePerMillion?: number | null) {
  if (inputPricePerMillion == null || outputPricePerMillion == null) return null;
  return (
    (ESTIMATE_INPUT_TOKENS / 1_000_000) * inputPricePerMillion +
    (ESTIMATE_OUTPUT_TOKENS / 1_000_000) * outputPricePerMillion
  );
}

function formatUsd(value: number | null | undefined) {
  if (value == null) return "–";
  return `$${value.toFixed(value < 0.01 ? 4 : 3)}`;
}

function formatKrwApprox(value: number | null | undefined) {
  if (value == null) return "";
  const krw = Math.round(value * 1350);
  return `약 ${krw.toLocaleString("ko-KR")}원`;
}

function formatDate(value: string | null) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusClass(status: ModelStatus) {
  if (status === "connected") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "error") return "border-red-500/30 bg-red-500/10 text-red-700";
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

function getHealthClass(health: HealthStatus) {
  if (health === "healthy") return "bg-emerald-500";
  if (health === "slow") return "bg-amber-500";
  return "bg-red-500";
}

function normalizeProvider(provider: string | null | undefined) {
  const value = String(provider ?? "unknown").toLowerCase();
  if (value === "google") return "gemini";
  if (value === "claude") return "anthropic";
  return value;
}

function getModelKey(provider: string | null | undefined, modelName: string | null | undefined) {
  return `${normalizeProvider(provider)}:${modelName ?? "unknown"}`;
}

function getHealth(avgResponseTimeMs: number, errorRate: number, hasApiKey: boolean): HealthStatus {
  if (!hasApiKey || errorRate >= 10) return "error";
  if (avgResponseTimeMs >= 1500 || errorRate >= 3) return "slow";
  return "healthy";
}

function getStatus(enabled: boolean, health: HealthStatus): ModelStatus {
  if (!enabled) return "disabled";
  if (health === "error") return "error";
  return "connected";
}

async function loadAiModelsData(): Promise<AiModelsData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const configResponse = await fetch("/api/admin/ai-models");
  const configPayload = await configResponse.json();
  if (!configResponse.ok) {
    throw new Error(configPayload?.message || configPayload?.error || "AI 모델 설정을 불러오지 못했습니다.");
  }

  const [
    templatesRes,
    usageRes,
    todayUsageRes,
    todayAnalysesRes,
    logsRes,
  ] = await Promise.all([
    supabase
      .from("prompt_templates")
      .select("model_name, model_provider, max_tokens, temperature, is_active, is_default, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("token_usages")
      .select("model_name, model_provider, total_tokens, cost, latency_ms, is_success, http_status, created_at")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("token_usages")
      .select("model_name, model_provider, total_tokens, cost, latency_ms, is_success, created_at")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("analyses")
      .select("status, response_time_ms, model_name, model_provider, created_at")
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("token_usages")
      .select("id, model_name, model_provider, total_tokens, cost, latency_ms, is_success, http_status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const queryError =
    templatesRes.error ||
    usageRes.error ||
    todayUsageRes.error ||
    todayAnalysesRes.error ||
    logsRes.error;

  if (queryError) {
    throw new Error(queryError.message);
  }

  const providerConfigs = new Map<string, ProviderConfig>();
  (configPayload.providers ?? []).forEach((provider: ProviderConfig) => {
    providerConfigs.set(normalizeProvider(provider.providerKey), provider);
  });

  const templateByKey = new Map<string, any>();
  const modelKeys = new Set<string>();

  (templatesRes.data ?? []).forEach((template: any) => {
    const key = getModelKey(template.model_provider, template.model_name);
    modelKeys.add(key);
    if (!templateByKey.has(key) || template.is_default || template.is_active) {
      templateByKey.set(key, template);
    }
  });

  (usageRes.data ?? []).forEach((row: any) => {
    modelKeys.add(getModelKey(row.model_provider, row.model_name));
  });

  (configPayload.configuredModels ?? []).forEach((model: ConfiguredModel) => {
    modelKeys.add(getModelKey(model.providerKey, model.modelName));
  });

  (configPayload.availableModels ?? [])
    .forEach((model: AvailableModel) => {
    modelKeys.add(getModelKey(model.providerKey, model.modelName));
  });

  const stats = new Map<string, {
    calls: number;
    successes: number;
    tokens: number;
    cost: number;
    latencySum: number;
    latencyCount: number;
    latest: string | null;
  }>();

  (usageRes.data ?? []).forEach((row: any) => {
    const key = getModelKey(row.model_provider, row.model_name);
    const current = stats.get(key) ?? {
      calls: 0,
      successes: 0,
      tokens: 0,
      cost: 0,
      latencySum: 0,
      latencyCount: 0,
      latest: null,
    };

    current.calls += 1;
    if (row.is_success) current.successes += 1;
    current.tokens += row.total_tokens ?? 0;
    current.cost += row.cost ?? 0;
    if (row.latency_ms) {
      current.latencySum += row.latency_ms;
      current.latencyCount += 1;
    }
    if (!current.latest || row.created_at > current.latest) current.latest = row.created_at;
    stats.set(key, current);
  });

  const configuredByKey = new Map<string, ConfiguredModel>();
  (configPayload.configuredModels ?? []).forEach((model: ConfiguredModel) => {
    configuredByKey.set(getModelKey(model.providerKey, model.modelName), model);
  });

  const availableByKey = new Map<string, AvailableModel>();
  (configPayload.availableModels ?? [])
    .forEach((model: AvailableModel) => {
    availableByKey.set(getModelKey(model.providerKey, model.modelName), model);
  });

  const models: AiModel[] = Array.from(modelKeys).map((key) => {
    const [providerKey, modelNameFromKey] = key.split(":");
    const template = templateByKey.get(key);
    const configuredModel = configuredByKey.get(key);
    const availableModel = availableByKey.get(key);
    const config = providerConfigs.get(providerKey);
    const stat = stats.get(key);
    const calls = stat?.calls ?? 0;
    const avgResponseTimeMs = stat?.latencyCount
      ? Math.round(stat.latencySum / stat.latencyCount)
      : 0;
    const errorRate = calls ? ((calls - (stat?.successes ?? 0)) / calls) * 100 : 0;
    const enabled = Boolean(template?.is_active || template?.is_default || configuredModel || availableModel || calls > 0);
    const health = getHealth(avgResponseTimeMs, errorRate, Boolean(config?.hasApiKey));

    const modelName = template?.model_name ?? configuredModel?.modelName ?? availableModel?.modelName ?? modelNameFromKey;
    const recommendation = RECOMMENDED_MODELS[modelName];

    return {
      id: key,
      provider: config?.provider ?? configuredModel?.provider ?? availableModel?.provider ?? providerKey,
      providerKey,
      modelName,
      status: getStatus(enabled, health),
      health,
      lastChecked: stat?.latest ?? template?.created_at ?? null,
      avgResponseTimeMs,
      totalRequests: calls,
      errorRate,
      estimatedCost: stat?.cost ?? 0,
      apiKeyMasked: config?.apiKeyMasked ?? "Not configured",
      baseUrl: config?.baseUrl ?? configuredModel?.baseUrl ?? availableModel?.baseUrl ?? "",
      maxTokens: template?.max_tokens ?? availableModel?.outputTokenLimit ?? null,
      temperature: template?.temperature ?? null,
      timeoutMs: 30000,
      enabled,
      isDefault: Boolean(
        template?.is_default ||
          configPayload.settings?.defaultModel?.providerKey === providerKey &&
            configPayload.settings?.defaultModel?.modelName === modelName
      ),
      isActive: Boolean(template?.is_active || configuredModel || availableModel),
      recommendationLabel: recommendation?.label ?? null,
      recommendationReason: recommendation?.reason ?? null,
      recommendationRank: recommendation?.rank ?? 99,
      inputPricePerMillion: recommendation?.inputPricePerMillion ?? null,
      outputPricePerMillion: recommendation?.outputPricePerMillion ?? null,
      estimatedCostPerCall: estimateCallCost(
        recommendation?.inputPricePerMillion,
        recommendation?.outputPricePerMillion
      ),
    };
  });

  const defaultModel =
    models.find((model) => model.isDefault) ??
    models.find((model) => model.isActive) ??
    models[0] ??
    null;
  const fallbackModel =
    models.find((model) => model.id !== defaultModel?.id && model.enabled && model.status === "connected") ??
    models.find((model) => model.id !== defaultModel?.id && model.enabled) ??
    null;

  const todayUsageRows = todayUsageRes.data ?? [];
  const todayAnalysesRows = todayAnalysesRes.data ?? [];
  const todaysRequests = todayUsageRows.length || todayAnalysesRows.length;
  const todayCost = todayUsageRows.reduce((sum: number, row: any) => sum + (row.cost ?? 0), 0);
  const latencyValues = [
    ...todayUsageRows.map((row: any) => row.latency_ms).filter(Boolean),
    ...todayAnalysesRows.map((row: any) => row.response_time_ms).filter(Boolean),
  ];
  const avgLatencyMs = latencyValues.length
    ? Math.round(latencyValues.reduce((sum: number, value: number) => sum + value, 0) / latencyValues.length)
    : 0;
  const failedRequests = todayUsageRows.length
    ? todayUsageRows.filter((row: any) => !row.is_success).length
    : todayAnalysesRows.filter((row: any) => row.status === "FAILED").length;

  return {
    summary: {
      connectedModels: models.filter((model) => model.status === "connected").length,
      totalModels: models.length,
      defaultModelId: defaultModel?.id ?? null,
      defaultModelName: defaultModel?.modelName ?? null,
      fallbackModelId: fallbackModel?.id ?? null,
      fallbackModelName: fallbackModel?.modelName ?? null,
      todaysRequests,
      avgLatencyMs,
      todaysEstimatedCost: todayCost,
      errorRate: todaysRequests ? (failedRequests / todaysRequests) * 100 : 0,
    },
    models: models.sort((a: any, b: any) => a.recommendationRank - b.recommendationRank || Number(b.isDefault) - Number(a.isDefault) || b.totalRequests - a.totalRequests),
    logs: (logsRes.data ?? []).map((log: any) => ({
      id: log.id,
      time: log.created_at,
      modelId: getModelKey(log.model_provider, log.model_name),
      modelName: log.model_name,
      provider: providerConfigs.get(normalizeProvider(log.model_provider))?.provider ?? log.model_provider,
      responseTimeMs: log.latency_ms,
      tokens: log.total_tokens,
      cost: log.cost ?? 0,
      success: log.is_success,
      errorMessage: log.is_success ? null : `HTTP ${log.http_status ?? "error"}`,
    })),
  };
}

export default function AiModelsPage() {
  const [data, setData] = useState<AiModelsData | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [defaultModelId, setDefaultModelId] = useState<string | null>(null);
  const [fallbackModelId, setFallbackModelId] = useState<string | null>(null);
  const [testingModelId, setTestingModelId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const payload = await loadAiModelsData();
      setData(payload);
      setSelectedModelId((current) => current ?? payload.models[0]?.id ?? null);
      setDefaultModelId(payload.summary.defaultModelId ?? payload.models[0]?.id ?? null);
      setFallbackModelId(payload.summary.fallbackModelId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI 모델 데이터를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const models = data?.models ?? [];
  const logs = data?.logs ?? [];
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? models[0] ?? null;
  const defaultModel = models.find((model) => model.id === defaultModelId) ?? null;
  const fallbackModel = models.find((model) => model.id === fallbackModelId) ?? null;

  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled),
    [models]
  );

  const saveModelSettings = async (nextDefaultId: string | null, nextFallbackId: string | null) => {
    const nextDefault = models.find((model) => model.id === nextDefaultId);
    const nextFallback = models.find((model) => model.id === nextFallbackId);

    if (!nextDefault) return;

    const response = await fetch("/api/admin/ai-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save-settings",
        defaultModel: {
          providerKey: nextDefault.providerKey,
          modelName: nextDefault.modelName,
        },
        fallbackModel: nextFallback
          ? {
              providerKey: nextFallback.providerKey,
              modelName: nextFallback.modelName,
            }
          : null,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || "모델 설정 저장에 실패했습니다.");
    }
    setSaveMessage("모델 설정이 저장되었습니다. 다음 분석 요청부터 기본 모델이 적용됩니다.");
    window.setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleDefaultModelChange = async (modelId: string) => {
    setDefaultModelId(modelId);
    setError(null);
    let nextFallbackId = fallbackModelId;
    if (fallbackModelId === modelId) {
      nextFallbackId = enabledModels.find((model) => model.id !== modelId)?.id ?? null;
      setFallbackModelId(nextFallbackId);
    }

    try {
      await saveModelSettings(modelId, nextFallbackId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "모델 설정 저장에 실패했습니다.");
    }
  };

  const handleFallbackModelChange = async (modelId: string) => {
    setFallbackModelId(modelId);
    setError(null);

    try {
      await saveModelSettings(defaultModelId, modelId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "모델 설정 저장에 실패했습니다.");
    }
  };

  const handleConnectionTest = async (model: AiModel) => {
    setSelectedModelId(model.id);
    setTestingModelId(model.id);
    setTestResult(null);

    try {
      const response = await fetch("/api/admin/ai-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerKey: model.providerKey,
          modelName: model.modelName,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || "Connection test failed.");
      }

      setTestResult(payload);
    } catch (e) {
      setTestResult({
        status: "failed",
        responseTimeMs: 0,
        message: e instanceof Error ? e.message : "Connection test failed.",
      });
    } finally {
      setTestingModelId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI Models"
        description="실제 DB 호출 이력과 프롬프트 설정을 기준으로 AI 모델 상태를 확인합니다."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={fetchModels}
            disabled={isLoading}
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
            새로고침
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {saveMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
          <CheckCircle2 className="size-4" />
          <AlertDescription>{saveMessage}</AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription>
          연결된 AI 제공자의 모델 중 PassMate 자기소개서 분석에 맞는 운영 후보만 표시합니다. 1회 예상 비용은 입력 {ESTIMATE_INPUT_TOKENS.toLocaleString("ko-KR")} 토큰, 출력 {ESTIMATE_OUTPUT_TOKENS.toLocaleString("ko-KR")} 토큰 기준입니다.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        <KpiCard
          title="Connected Models"
          value={data ? `${data.summary.connectedModels}/${data.summary.totalModels}` : null}
          description="실제 연결 상태"
          icon={ShieldCheck}
          isLoading={isLoading}
        />
        <KpiCard
          title="Default Model"
          value={defaultModel?.modelName ?? data?.summary.defaultModelName ?? null}
          description={defaultModel?.provider ?? undefined}
          icon={Zap}
          isLoading={isLoading}
          className="[&_.tabular-nums]:truncate [&_.tabular-nums]:text-lg"
        />
        <KpiCard
          title="Today's Requests"
          value={data?.summary.todaysRequests ?? null}
          description="오늘 token_usages 기준"
          icon={Activity}
          isLoading={isLoading}
        />
        <KpiCard
          title="Average Latency"
          value={data ? formatMs(data.summary.avgLatencyMs) : null}
          description="오늘 평균"
          icon={Timer}
          isLoading={isLoading}
        />
        <KpiCard
          title="Today's Estimated Cost"
          value={data ? `$${data.summary.todaysEstimatedCost.toFixed(4)}` : null}
          description="USD"
          icon={DollarSign}
          positiveIsGood={false}
          isLoading={isLoading}
        />
        <KpiCard
          title="Error Rate"
          value={data ? `${data.summary.errorRate.toFixed(1)}%` : null}
          description="오늘 실패율"
          icon={AlertTriangle}
          positiveIsGood={false}
          isLoading={isLoading}
          variant={(data?.summary.errorRate ?? 0) > 5 ? "highlight" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Recommended Models</CardTitle>
                <CardDescription>가성비, 응답 품질, 운영 안정성을 기준으로 추린 후보입니다.</CardDescription>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Select
                  value={defaultModelId ?? undefined}
                  onValueChange={handleDefaultModelChange}
                  disabled={enabledModels.length === 0}
                >
                  <SelectTrigger className="w-full sm:w-[220px]" size="sm">
                    <SelectValue placeholder="Default Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        Default: {model.modelName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={fallbackModelId ?? undefined}
                  onValueChange={handleFallbackModelChange}
                  disabled={enabledModels.length <= 1}
                >
                  <SelectTrigger className="w-full sm:w-[220px]" size="sm">
                    <SelectValue placeholder="Fallback Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledModels
                      .filter((model) => model.id !== defaultModelId)
                      .map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          Fallback: {model.modelName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {models.length === 0 && !isLoading ? (
              <div className="flex min-h-[220px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                추천 후보 모델을 불러오지 못했습니다. API 키와 모델 조회 권한을 확인해주세요.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Checked</TableHead>
                    <TableHead>Avg Response Time</TableHead>
                    <TableHead>Estimated / Call</TableHead>
                    <TableHead>Total Requests</TableHead>
                    <TableHead>Error %</TableHead>
                    <TableHead>Estimated Cost</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow
                      key={model.id}
                      data-state={selectedModel?.id === model.id ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedModelId(model.id);
                        setTestResult(null);
                      }}
                    >
                      <TableCell className="font-medium">{model.provider}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{model.modelName}</span>
                          {model.recommendationLabel && (
                            <Badge variant="secondary" className="text-[10px]">
                              {model.recommendationLabel}
                            </Badge>
                          )}
                          {defaultModelId === model.id && (
                            <Badge variant="outline" className="text-[10px]">Default</Badge>
                          )}
                          {fallbackModelId === model.id && (
                            <Badge variant="outline" className="text-[10px]">Fallback</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusClass(model.status)}>
                          {statusCopy[model.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(model.lastChecked)}</TableCell>
                      <TableCell>{formatMs(model.avgResponseTimeMs)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span>{formatUsd(model.estimatedCostPerCall)}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatKrwApprox(model.estimatedCostPerCall)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{model.totalRequests.toLocaleString("ko-KR")}</TableCell>
                      <TableCell>
                        <span className={cn(model.errorRate > 10 && "text-red-600 font-medium")}>
                          {model.errorRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell>${model.estimatedCost.toFixed(4)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleConnectionTest(model);
                          }}
                          disabled={testingModelId === model.id}
                        >
                          {testingModelId === model.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Play className="size-3.5" />
                          )}
                          Live Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4" />
              Model Detail
            </CardTitle>
            <CardDescription>
              {selectedModel ? `${selectedModel.provider} 실제 설정` : "모델을 선택해주세요"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {selectedModel ? (
              <>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", getHealthClass(selectedModel.health))} />
                    <div>
                      <p className="text-sm font-medium">Health Status</p>
                      <p className="text-xs text-muted-foreground">{healthCopy[selectedModel.health]}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusClass(selectedModel.status)}>
                    {statusCopy[selectedModel.status]}
                  </Badge>
                </div>

                <div className="space-y-3 text-sm">
                  {[
                    ["Provider", selectedModel.provider],
                    ["Model", selectedModel.modelName],
                    ["Recommendation", selectedModel.recommendationReason ?? "실제 사용 이력 또는 저장 설정으로 표시됨"],
                    ["Estimated / Call", `${formatUsd(selectedModel.estimatedCostPerCall)} ${formatKrwApprox(selectedModel.estimatedCostPerCall)}`],
                    ["Pricing", selectedModel.inputPricePerMillion != null && selectedModel.outputPricePerMillion != null
                      ? `Input $${selectedModel.inputPricePerMillion}/1M · Output $${selectedModel.outputPricePerMillion}/1M`
                      : "–"],
                    ["API Key", selectedModel.apiKeyMasked],
                    ["Base URL", selectedModel.baseUrl || "–"],
                    ["Max Tokens", selectedModel.maxTokens?.toLocaleString("ko-KR") ?? "–"],
                    ["Temperature", selectedModel.temperature?.toString() ?? "–"],
                    ["Timeout", formatMs(selectedModel.timeoutMs)],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                      <span className="text-muted-foreground">{label}</span>
                      <span
                        className={cn(
                          "font-medium",
                          label === "Recommendation" ? "whitespace-normal leading-relaxed" : "truncate"
                        )}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="model-enabled" className="text-sm font-medium">
                    Enabled
                  </Label>
                  <Switch id="model-enabled" checked={selectedModel.enabled} disabled />
                </div>

                <div className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Latency Budget</span>
                    <span className="font-medium">{formatMs(selectedModel.avgResponseTimeMs)}</span>
                  </div>
                  <Progress
                    value={Math.min((selectedModel.avgResponseTimeMs / selectedModel.timeoutMs) * 100, 100)}
                    className={cn(
                      selectedModel.health === "healthy" && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
                      selectedModel.health === "slow" && "[&_[data-slot=progress-indicator]]:bg-amber-500",
                      selectedModel.health === "error" && "[&_[data-slot=progress-indicator]]:bg-red-500"
                    )}
                  />
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={() => handleConnectionTest(selectedModel)}
                  disabled={testingModelId === selectedModel.id}
                >
                  {testingModelId === selectedModel.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <KeyRound className="size-4" />
                  )}
                  Connection Test
                </Button>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  실제 제공자 API에 짧은 테스트 프롬프트를 보내므로 유료 계정에서는 아주 소액의 과금이 발생할 수 있습니다.
                </p>

                {testResult && (
                  <div
                    className={cn(
                      "rounded-md border p-3 text-sm",
                      testResult.status === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-red-500/30 bg-red-500/10"
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      {testResult.status === "success" ? (
                        <CheckCircle2 className="size-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="size-4 text-red-600" />
                      )}
                      {testResult.status === "success" ? "Success" : "Failed"}
                    </div>
                    <p className="text-muted-foreground">
                      응답시간 {formatMs(testResult.responseTimeMs)} · {testResult.message}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                표시할 실제 모델 데이터가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="size-4" />
            Recent Call Logs
          </CardTitle>
          <CardDescription>token_usages 테이블의 최신 50건입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && !isLoading ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              아직 저장된 AI 호출 로그가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>시간</TableHead>
                  <TableHead>모델</TableHead>
                  <TableHead>응답시간</TableHead>
                  <TableHead>토큰 수</TableHead>
                  <TableHead>비용</TableHead>
                  <TableHead>성공/실패</TableHead>
                  <TableHead>오류 메시지</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{formatDate(log.time)}</TableCell>
                    <TableCell>{log.modelName}</TableCell>
                    <TableCell>{formatMs(log.responseTimeMs)}</TableCell>
                    <TableCell>{log.tokens.toLocaleString("ko-KR")}</TableCell>
                    <TableCell>${log.cost.toFixed(4)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          log.success
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                            : "border-red-500/30 bg-red-500/10 text-red-700"
                        }
                      >
                        {log.success ? "Success" : "Failed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[360px] truncate text-muted-foreground">
                      {log.errorMessage ?? "–"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
