import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Settings2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  formatKrwApprox,
  formatMs,
  formatUsd,
  getHealthClass,
  getStatusClass,
  healthCopy,
  statusCopy,
  type AiModel,
  type TestResult,
} from "@/pages/admin/ai-models/aiModelsModel";

/** 선택한 모델의 실제 설정·헬스·연결 테스트. */
export function ModelDetailCard({
  model,
  testResult,
  testingModelId,
  onTest,
}: {
  model: AiModel | null;
  testResult: TestResult | null;
  testingModelId: string | null;
  onTest: (model: AiModel) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="size-4" />
          Model Detail
        </CardTitle>
        <CardDescription>
          {model ? `${model.provider} 실제 설정` : "모델을 선택해주세요"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {model ? (
          <>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2">
                <span className={cn("size-2.5 rounded-full", getHealthClass(model.health))} />
                <div>
                  <p className="text-sm font-medium">Health Status</p>
                  <p className="text-xs text-muted-foreground">{healthCopy[model.health]}</p>
                </div>
              </div>
              <Badge variant="outline" className={getStatusClass(model.status)}>
                {statusCopy[model.status]}
              </Badge>
            </div>

            <div className="space-y-3 text-sm">
              {[
                ["Provider", model.provider],
                ["Model", model.modelName],
                ["Recommendation", model.recommendationReason ?? "실제 사용 이력 또는 저장 설정으로 표시됨"],
                ["Estimated / Call", `${formatUsd(model.estimatedCostPerCall)} ${formatKrwApprox(model.estimatedCostPerCall)}`],
                ["Pricing", model.inputPricePerMillion != null && model.outputPricePerMillion != null
                  ? `Input $${model.inputPricePerMillion}/1M · Output $${model.outputPricePerMillion}/1M`
                  : "–"],
                ["API Key", model.apiKeyMasked],
                ["Live Check", model.connectionMessage ?? "아직 live check 결과가 없습니다."],
                ["Base URL", model.baseUrl || "–"],
                ["Max Tokens", model.maxTokens?.toLocaleString("ko-KR") ?? "–"],
                ["Temperature", model.temperature?.toString() ?? "–"],
                ["Timeout", formatMs(model.timeoutMs)],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span
                    className={cn(
                      "font-medium",
                      label === "Recommendation" || label === "Live Check"
                        ? "whitespace-normal leading-relaxed"
                        : "truncate"
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
              <Switch id="model-enabled" checked={model.enabled} disabled />
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Latency Budget</span>
                <span className="font-medium">{formatMs(model.avgResponseTimeMs)}</span>
              </div>
              <Progress
                value={Math.min((model.avgResponseTimeMs / model.timeoutMs) * 100, 100)}
                className={cn(
                  model.health === "healthy" && "[&_[data-slot=progress-indicator]]:bg-emerald-500",
                  model.health === "slow" && "[&_[data-slot=progress-indicator]]:bg-amber-500",
                  model.health === "error" && "[&_[data-slot=progress-indicator]]:bg-red-500"
                )}
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={() => onTest(model)}
              disabled={testingModelId === model.id}
            >
              {testingModelId === model.id ? (
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
  );
}
