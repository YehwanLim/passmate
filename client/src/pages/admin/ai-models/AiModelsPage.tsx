import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Timer,
  Zap,
} from "lucide-react";

import { CallLogsTable } from "@/components/admin/ai-models/CallLogsTable";
import { ModelDetailCard } from "@/components/admin/ai-models/ModelDetailCard";
import { ModelsTable } from "@/components/admin/ai-models/ModelsTable";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { KpiCard } from "@/components/admin/dashboard/KpiCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { adminApiFetch } from "@/lib/adminApi";
import {
  ESTIMATE_INPUT_TOKENS,
  ESTIMATE_OUTPUT_TOKENS,
  formatMs,
  type AiModel,
  type AiModelsData,
  type TestResult,
} from "./aiModelsModel";
import { loadAiModelsData } from "./loadAiModelsData";

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

  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled && model.status === "connected"),
    [models]
  );

  const saveModelSettings = async (nextDefaultId: string | null, nextFallbackId: string | null) => {
    const nextDefault = models.find((model) => model.id === nextDefaultId);
    const nextFallback = models.find((model) => model.id === nextFallbackId);

    if (!nextDefault) return;

    await adminApiFetch("/api/admin/ai-models", {
      method: "POST",
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
      const payload = await adminApiFetch<TestResult>("/api/admin/ai-models", {
        method: "POST",
        body: JSON.stringify({
          action: "test-model",
          providerKey: model.providerKey,
          modelName: model.modelName,
        }),
      });
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
          <AdminRefreshControl lastRefreshed={null} isLoading={isLoading} onRefresh={fetchModels} />
        }
      />

      <AdminErrorAlert message={error} />

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
        <ModelsTable
          models={models}
          enabledModels={enabledModels}
          isLoading={isLoading}
          selectedModelId={selectedModel?.id ?? null}
          defaultModelId={defaultModelId}
          fallbackModelId={fallbackModelId}
          testingModelId={testingModelId}
          onSelect={(model) => {
            setSelectedModelId(model.id);
            setTestResult(null);
          }}
          onTest={(model) => void handleConnectionTest(model)}
          onDefaultChange={(modelId) => void handleDefaultModelChange(modelId)}
          onFallbackChange={(modelId) => void handleFallbackModelChange(modelId)}
        />

        <ModelDetailCard
          model={selectedModel}
          testResult={testResult}
          testingModelId={testingModelId}
          onTest={(model) => void handleConnectionTest(model)}
        />
      </div>

      <CallLogsTable logs={logs} isLoading={isLoading} />
    </div>
  );
}
