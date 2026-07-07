import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Info } from "lucide-react";
import type { ModelUsageItem } from "@/hooks/admin/useAiUsageData";

interface ModelUsageSectionProps {
  data: ModelUsageItem[];
  isLoading: boolean;
}

export function ModelUsageSection({ data, isLoading }: ModelUsageSectionProps) {
  // 비용 기준 최대값 계산 (비율 그래프용)
  const maxCost = data.length > 0 ? Math.max(...data.map((m) => m.cost)) : 1;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          모델별 사용 현황
        </CardTitle>
        <CardDescription className="text-xs">
          최근 7일간 각 AI 모델의 누적 호출 횟수와 리소스 비용 점유율입니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Info className="size-8 mb-2 opacity-30" />
            <p className="text-sm">사용 기록이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">모델명</TableHead>
                  <TableHead className="w-[100px]">제공자</TableHead>
                  <TableHead className="w-[100px] text-right">호출수</TableHead>
                  <TableHead className="w-[120px] text-right">총 토큰</TableHead>
                  <TableHead className="w-[120px] text-right">예상 비용 (USD)</TableHead>
                  <TableHead className="min-w-[150px]">비용 비율</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((m) => {
                  const percentage = maxCost > 0 ? Math.round((m.cost / maxCost) * 100) : 0;
                  return (
                    <TableRow key={m.modelName} className="hover:bg-muted/30">
                      <TableCell className="font-medium font-mono text-xs">
                        {m.modelName}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground capitalize">
                        {m.provider}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {m.calls.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {m.tokens.toLocaleString("ko-KR")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-500 font-semibold">
                        ${m.cost.toFixed(4)}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-2">
                          <Progress value={percentage} className="h-2 flex-1" />
                          <span className="text-[10px] text-muted-foreground w-8 text-right font-mono">
                            {percentage}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
