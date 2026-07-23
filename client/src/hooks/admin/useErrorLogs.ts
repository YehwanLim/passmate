import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export type ErrorTypeFilter = "ALL" | "TIMEOUT" | "API_ERROR" | "HTTP_500" | "PARSE_ERROR" | "UNKNOWN";
export interface ErrorLogItem { id: string; analysisId: string; userEmail: string | null; userName: string | null; errorCode: string | null; errorMessage: string | null; httpStatus: number | null; modelName: string | null; responseTimeMs: number | null; createdAt: string; questionText: string; inputText: string; }
export interface UseErrorLogsParams { search: string; errorType: ErrorTypeFilter; page: number; pageSize: number; }

export function useErrorLogs({ search, errorType, page, pageSize }: UseErrorLogsParams) {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]); const [total, setTotal] = useState(0); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [tick, setTick] = useState(0); const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true); setError(null);
      try {
        const params = new URLSearchParams({ search, errorType, page: String(page), pageSize: String(pageSize) });
        const data = await adminApiFetch<{ logs: ErrorLogItem[]; total: number }>(`/api/admin/analyses?${params}`);
        if (!cancelled) { setLogs(data.logs); setTotal(data.total); setIsLoading(false); setLastRefreshed(new Date()); }
      } catch (cause) { if (!cancelled) { setError(cause instanceof Error ? cause.message : "오류 로그를 불러오지 못했습니다."); setIsLoading(false); } }
    };
    load(); return () => { cancelled = true; };
  }, [errorType, page, pageSize, search, tick]);
  return { logs, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), isLoading, error, refresh, lastRefreshed };
}
