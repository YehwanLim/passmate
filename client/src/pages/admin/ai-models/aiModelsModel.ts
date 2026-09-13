// AI 모델 화면의 타입·상수·순수 헬퍼. 데이터 조립은 loadAiModelsData.ts, 화면은 AiModelsPage.tsx.

export type ModelStatus = "connected" | "error" | "disabled";
export type HealthStatus = "healthy" | "slow" | "error";

export interface AiModel {
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
  connectionMessage?: string | null;
}

export interface CallLog {
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

export interface AiModelsData {
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

export interface TestResult {
  status: "success" | "failed";
  responseTimeMs: number;
  message: string;
}

export interface ProviderConfig {
  providerKey: string;
  provider: string;
  baseUrl: string;
  hasApiKey: boolean;
  apiKeyMasked: string;
}

export interface ConfiguredModel {
  providerKey: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  source: string;
}

export interface AvailableModel extends ConfiguredModel {
  displayName?: string;
  description?: string;
  inputTokenLimit?: number | null;
  outputTokenLimit?: number | null;
}

export interface LiveModelStatus {
  providerKey: string;
  modelName: string;
  status: "success" | "failed";
  responseTimeMs: number;
  message: string;
  checkedAt: string;
}

export const statusCopy: Record<ModelStatus, string> = {
  connected: "정상",
  error: "오류",
  disabled: "비활성",
};

export const healthCopy: Record<HealthStatus, string> = {
  healthy: "정상",
  slow: "느림",
  error: "오류",
};

export const ESTIMATE_INPUT_TOKENS = 6000;
export const ESTIMATE_OUTPUT_TOKENS = 3000;

export const RECOMMENDED_MODELS: Record<string, {
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
    label: "최저가",
    reason: "런칭 전 실제 호출 흐름과 리포트 품질을 가장 낮은 비용으로 확인할 때 사용",
    rank: 4,
    inputPricePerMillion: 0.2,
    outputPricePerMillion: 1.25,
  },
  "gpt-5.4-mini": {
    label: "저가",
    reason: "최저가 모델보다 조금 더 나은 품질을 비교할 때 사용",
    rank: 5,
    inputPricePerMillion: 0.75,
    outputPricePerMillion: 4.5,
  },
  "gpt-5.6-luna": {
    label: "품질 비교",
    reason: "비용은 오르지만 최신 계열의 품질 기준선을 보고 싶을 때 사용",
    rank: 6,
    inputPricePerMillion: 1,
    outputPricePerMillion: 6,
  },
};

export function formatMs(value: number | null | undefined) {
  if (!value) return "–";
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${value}ms`;
}

export function estimateCallCost(inputPricePerMillion?: number | null, outputPricePerMillion?: number | null) {
  if (inputPricePerMillion == null || outputPricePerMillion == null) return null;
  return (
    (ESTIMATE_INPUT_TOKENS / 1_000_000) * inputPricePerMillion +
    (ESTIMATE_OUTPUT_TOKENS / 1_000_000) * outputPricePerMillion
  );
}

export function formatUsd(value: number | null | undefined) {
  if (value == null) return "–";
  return `$${value.toFixed(value < 0.01 ? 4 : 3)}`;
}

export function formatKrwApprox(value: number | null | undefined) {
  if (value == null) return "";
  const krw = Math.round(value * 1350);
  return `약 ${krw.toLocaleString("ko-KR")}원`;
}

export function getStatusClass(status: ModelStatus) {
  if (status === "connected") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  if (status === "error") return "border-red-500/30 bg-red-500/10 text-red-700";
  return "border-muted-foreground/20 bg-muted text-muted-foreground";
}

export function getHealthClass(health: HealthStatus) {
  if (health === "healthy") return "bg-emerald-500";
  if (health === "slow") return "bg-amber-500";
  return "bg-red-500";
}

export function normalizeProvider(provider: string | null | undefined) {
  const value = String(provider ?? "unknown").toLowerCase();
  if (value === "google") return "gemini";
  if (value === "claude") return "anthropic";
  return value;
}

export function getModelKey(provider: string | null | undefined, modelName: string | null | undefined) {
  return `${normalizeProvider(provider)}:${modelName ?? "unknown"}`;
}

export function getHealth(avgResponseTimeMs: number, errorRate: number, hasApiKey: boolean, liveStatus?: LiveModelStatus): HealthStatus {
  if (!hasApiKey || liveStatus?.status === "failed" || errorRate >= 10) return "error";
  if (avgResponseTimeMs >= 1500 || errorRate >= 3) return "slow";
  return "healthy";
}

export function getStatus(enabled: boolean, health: HealthStatus): ModelStatus {
  if (!enabled) return "disabled";
  if (health === "error") return "error";
  return "connected";
}
