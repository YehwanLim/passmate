import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { LogDetailDialog } from "./LogDetailDialog";
import { AlertCircle, Eye, ShieldAlert } from "lucide-react";
import type { ErrorLogItem } from "@/hooks/admin/useErrorLogs";

// ============================================================
// 유틸
// ============================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    second: "2-digit",
  });
}

function getErrorBadgeVariant(code: string | null) {
  if (code === "TIMEOUT") return "outline";
  if (code === "API_ERROR") return "destructive";
  return "secondary";
}

// ============================================================
// 로딩 스켈레톤
// ============================================================

function RowSkeleton() {
  return (
    <TableRow>
      {[100, 160, 280, 70, 110, 40].map((w, i) => (
        <TableCell key={i} className={i === 4 ? "hidden md:table-cell" : ""}>
          <Skeleton className="h-4" style={{ width: w }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ============================================================
// Component
// ============================================================

interface LogsTableProps {
  logs: ErrorLogItem[];
  isLoading: boolean;
}

export function LogsTable({ logs, isLoading }: LogsTableProps) {
  const [selectedLog, setSelectedLog] = useState<ErrorLogItem | null>(null);

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[110px]">에러 코드</TableHead>
              <TableHead className="w-[180px]">사용자</TableHead>
              <TableHead>에러 메시지</TableHead>
              <TableHead className="w-[80px] text-center">HTTP 상태</TableHead>
              <TableHead className="hidden md:table-cell w-[140px] text-right">발생 시각</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  기록된 에러 로그가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow
                  key={log.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedLog(log)}
                >
                  {/* 에러 코드 */}
                  <TableCell>
                    <Badge
                      variant={getErrorBadgeVariant(log.errorCode)}
                      className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5"
                    >
                      {log.errorCode}
                    </Badge>
                  </TableCell>

                  {/* 사용자 */}
                  <TableCell>
                    <div className="min-w-0">
                      {log.userName && (
                        <p className="text-xs font-medium truncate leading-tight">
                          {log.userName}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate leading-tight">
                        {log.userEmail ?? "–"}
                      </p>
                    </div>
                  </TableCell>

                  {/* 에러 메시지 프리뷰 */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <AlertCircle className="size-3.5 text-destructive flex-shrink-0" />
                      <p className="text-sm truncate text-foreground font-mono max-w-[280px] sm:max-w-[400px]">
                        {log.errorMessage || "에러 세부 정보 없음"}
                      </p>
                    </div>
                  </TableCell>

                  {/* HTTP 상태 */}
                  <TableCell className="text-center font-mono text-xs font-semibold text-red-500">
                    {log.httpStatus ? `500` : "–"}
                  </TableCell>

                  {/* 발생 시각 */}
                  <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.createdAt)}
                  </TableCell>

                  {/* 상세보기 버튼 */}
                  <TableCell>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Eye className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 모달 상세보기 팝업 */}
      <LogDetailDialog
        log={selectedLog}
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
      />
    </>
  );
}
