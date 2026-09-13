import { Loader2, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";
import {
  formatKrwApprox,
  formatMs,
  formatUsd,
  getStatusClass,
  statusCopy,
  type AiModel,
} from "@/pages/admin/ai-models/aiModelsModel";

/** 추천 모델 표 + 기본/폴백 모델 선택. 행 클릭은 상세 카드 선택, Live Test 는 행 안에서 바로. */
export function ModelsTable({
  models,
  enabledModels,
  isLoading,
  selectedModelId,
  defaultModelId,
  fallbackModelId,
  testingModelId,
  onSelect,
  onTest,
  onDefaultChange,
  onFallbackChange,
}: {
  models: AiModel[];
  enabledModels: AiModel[];
  isLoading: boolean;
  selectedModelId: string | null;
  defaultModelId: string | null;
  fallbackModelId: string | null;
  testingModelId: string | null;
  onSelect: (model: AiModel) => void;
  onTest: (model: AiModel) => void;
  onDefaultChange: (modelId: string) => void;
  onFallbackChange: (modelId: string) => void;
}) {
  return (
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
              onValueChange={onDefaultChange}
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
              onValueChange={onFallbackChange}
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
                  data-state={selectedModelId === model.id ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => onSelect(model)}
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
                  <TableCell className="text-muted-foreground">{formatDate(model.lastChecked, "md-hm")}</TableCell>
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
                        onTest(model);
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
  );
}
