import { useAdminPagedResource } from "./useAdminPagedResource";

export type ErrorTypeFilter = "ALL" | "TIMEOUT" | "API_ERROR" | "HTTP_500" | "PARSE_ERROR" | "UNKNOWN";
export interface ErrorLogItem { id: string; analysisId: string; userEmail: string | null; userName: string | null; errorCode: string | null; errorMessage: string | null; httpStatus: number | null; modelName: string | null; responseTimeMs: number | null; createdAt: string; questionText: string; inputText: string; }
export interface UseErrorLogsParams { search: string; errorType: ErrorTypeFilter; page: number; pageSize: number; }

export function useErrorLogs({ search, errorType, page, pageSize }: UseErrorLogsParams) {
  const { rows: logs, total, totalPages, isLoading, error, refresh, lastRefreshed } = useAdminPagedResource<ErrorLogItem, { logs: ErrorLogItem[]; total: number }>(
    "/api/admin/analyses",
    { search, errorType, page, pageSize },
    pageSize,
    { select: (data) => ({ rows: data.logs, total: data.total }), errorMessage: "오류 로그를 불러오지 못했습니다." },
  );
  return { logs, total, totalPages, isLoading, error, refresh, lastRefreshed };
}
