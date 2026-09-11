import { useState, useCallback } from "react";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminPagination } from "@/components/admin/shared/AdminPagination";
import { AdminRefreshControl } from "@/components/admin/shared/AdminRefreshControl";
import { LogsTable } from "@/components/admin/logs/LogsTable";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useErrorLogs, type ErrorTypeFilter } from "@/hooks/admin/useErrorLogs";
import { Search, ShieldAlert } from "lucide-react";

const PAGE_SIZE = 15;

const ERROR_TYPE_OPTIONS: { value: ErrorTypeFilter; label: string }[] = [
  { value: "ALL", label: "전체 에러 유형" },
  { value: "TIMEOUT", label: "⏳ Timeout" },
  { value: "API_ERROR", label: "🤖 API Error" },
  { value: "HTTP_500", label: "💥 500 Error" },
  { value: "PARSE_ERROR", label: "📝 Parse Error" },
  { value: "UNKNOWN", label: "❓ Unknown" },
];

export default function LogsPage() {
  const [search, setSearch] = useState("");
  const [errorType, setErrorType] = useState<ErrorTypeFilter>("ALL");
  const [page, setPage] = useState(1);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((v: ErrorTypeFilter) => {
    setErrorType(v);
    setPage(1);
  }, []);

  const { logs, total, totalPages, isLoading, error, refresh, lastRefreshed } =
    useErrorLogs({
      search,
      errorType,
      page,
      pageSize: PAGE_SIZE,
    });

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <AdminPageHeader
        title="Logs"
        description="시스템 분석 실패 로그를 실시간 추적하고 인프라 오작동을 분석합니다."
        actions={
          <div className="flex items-center gap-2">
            <AdminRefreshControl
              lastRefreshed={lastRefreshed}
              isLoading={isLoading}
              onRefresh={refresh}
              id="logs-refresh-btn"
            />
          </div>
        }
      />

      <AdminErrorAlert message={error} />

      {/* 검색 및 필터 패널 */}
      <div className="flex flex-col sm:flex-row items-center gap-2">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="logs-search"
            placeholder="에러 내용, 사용자 메일 검색..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* 에러 코드 필터 */}
        <Select value={errorType} onValueChange={(v) => handleTypeChange(v as ErrorTypeFilter)}>
          <SelectTrigger id="logs-type-filter" className="h-9 w-[150px]">
            <ShieldAlert className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ERROR_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isLoading && (
          <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
            검색 결과: {total.toLocaleString("ko-KR")}건
          </span>
        )}
      </div>

      {/* 테이블 */}
      <LogsTable logs={logs} isLoading={isLoading} />

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
