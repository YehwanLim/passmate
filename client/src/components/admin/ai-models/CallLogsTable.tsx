import { Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/formatDate";
import { formatMs, type CallLog } from "@/pages/admin/ai-models/aiModelsModel";

/** token_usages 최신 50건. */
export function CallLogsTable({ logs, isLoading }: { logs: CallLog[]; isLoading: boolean }) {
  return (
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
                  <TableCell className="text-muted-foreground">{formatDate(log.time, "md-hm")}</TableCell>
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
  );
}
