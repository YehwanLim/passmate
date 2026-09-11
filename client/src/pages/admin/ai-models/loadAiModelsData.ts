import { adminApiFetch } from "@/lib/adminApi";
import {
  RECOMMENDED_MODELS,
  estimateCallCost,
  getHealth,
  getModelKey,
  getStatus,
  normalizeProvider,
  type AiModel,
  type AiModelsData,
  type AvailableModel,
  type ConfiguredModel,
  type LiveModelStatus,
  type ProviderConfig,
} from "./aiModelsModel";

/**
 * 설정 응답(/api/admin/ai-models)과 사용량 응답(/api/admin/usage?view=models)을 합쳐
 * 화면이 쓰는 모델 목록·요약·호출 로그로 조립한다. 네트워크가 없는 순수 함수라 테스트할 수 있다.
 */
export function buildAiModelsData(configPayload: any, usagePayload: any): AiModelsData {
  const templates = usagePayload.templates ?? [];
  const usageRows = usagePayload.usageRows ?? [];
  const todayUsageRows = usagePayload.todayUsageRows ?? [];
  const todayAnalysesRows = usagePayload.todayAnalysesRows ?? [];
  const logs = usagePayload.logs ?? [];

  const providerConfigs = new Map<string, ProviderConfig>();
  (configPayload.providers ?? []).forEach((provider: ProviderConfig) => {
    providerConfigs.set(normalizeProvider(provider.providerKey), provider);
  });

  const templateByKey = new Map<string, any>();
  const modelKeys = new Set<string>();

  templates.forEach((template: any) => {
    const key = getModelKey(template.model_provider, template.model_name);
    modelKeys.add(key);
    if (!templateByKey.has(key) || template.is_default || template.is_active) {
      templateByKey.set(key, template);
    }
  });

  usageRows.forEach((row: any) => {
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

  usageRows.forEach((row: any) => {
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

  const liveStatusByKey = new Map<string, LiveModelStatus>();
  (configPayload.liveStatuses ?? []).forEach((status: LiveModelStatus) => {
    liveStatusByKey.set(getModelKey(status.providerKey, status.modelName), status);
  });

  const models: AiModel[] = Array.from(modelKeys).map((key) => {
    const [providerKey, modelNameFromKey] = key.split(":");
    const template = templateByKey.get(key);
    const configuredModel = configuredByKey.get(key);
    const availableModel = availableByKey.get(key);
    const liveStatus = liveStatusByKey.get(key);
    const config = providerConfigs.get(providerKey);
    const stat = stats.get(key);
    const calls = stat?.calls ?? 0;
    const avgResponseTimeMs = stat?.latencyCount
      ? Math.round(stat.latencySum / stat.latencyCount)
      : 0;
    const errorRate = calls ? ((calls - (stat?.successes ?? 0)) / calls) * 100 : 0;
    const modelName = template?.model_name ?? configuredModel?.modelName ?? availableModel?.modelName ?? modelNameFromKey;
    const liveResponseTimeMs = liveStatus?.responseTimeMs ?? null;
    const effectiveResponseTimeMs = liveResponseTimeMs || avgResponseTimeMs;
    const enabled = Boolean(config?.hasApiKey && (template?.is_active || template?.is_default || configuredModel || availableModel || calls > 0));
    const health = getHealth(effectiveResponseTimeMs, errorRate, Boolean(config?.hasApiKey), liveStatus);

    const recommendation = RECOMMENDED_MODELS[modelName];

    return {
      id: key,
      provider: config?.provider ?? configuredModel?.provider ?? availableModel?.provider ?? providerKey,
      providerKey,
      modelName,
      status: getStatus(enabled, health),
      health,
      lastChecked: liveStatus?.checkedAt ?? stat?.latest ?? template?.created_at ?? null,
      avgResponseTimeMs: effectiveResponseTimeMs,
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
      connectionMessage: liveStatus?.message ?? null,
    };
  });

  const connectedModels = models.filter((model) => model.status === "connected");
  const defaultModel =
    connectedModels.find((model) => model.isDefault) ??
    connectedModels.find((model) => model.isActive) ??
    connectedModels[0] ??
    models.find((model) => model.isDefault) ??
    models[0] ??
    null;
  // 폴백은 저장된 설정만 근거로 삼는다. 추측으로 채우면 저장되지 않은 값이
  // 저장된 것처럼 보여, 같은 값을 다시 선택해도 저장이 실행되지 않는다.
  const savedFallback = configPayload.settings?.fallbackModel ?? null;
  const fallbackModel = savedFallback
    ? models.find(
        (model) => model.id === getModelKey(savedFallback.providerKey, savedFallback.modelName)
      ) ?? null
    : null;

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
      connectedModels: connectedModels.length,
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
    logs: logs.map((log: any) => ({
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

export async function loadAiModelsData(): Promise<AiModelsData> {
  const [configPayload, usagePayload] = await Promise.all([
    adminApiFetch<any>("/api/admin/ai-models"),
    adminApiFetch<any>("/api/admin/usage?view=models"),
  ]);
  return buildAiModelsData(configPayload, usagePayload);
}
