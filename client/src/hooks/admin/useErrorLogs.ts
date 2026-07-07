import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입 정의
// ============================================================

export type ErrorTypeFilter = "ALL" | "TIMEOUT" | "API_ERROR" | "HTTP_500" | "PARSE_ERROR" | "UNKNOWN";

export interface ErrorLogItem {
  id: string;
  analysisId: string;
  userEmail: string | null;
  userName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  httpStatus: number | null;
  modelName: string | null;
  responseTimeMs: number | null;
  createdAt: string;
  // 상세보기용 입력문
  questionText: string;
  inputText: string;
}

export interface UseErrorLogsParams {
  search: string;
  errorType: ErrorTypeFilter;
  page: number;
  pageSize: number;
}

// ============================================================
// 훅 구현
// ============================================================

export function useErrorLogs({
  search,
  errorType,
  page,
  pageSize,
}: UseErrorLogsParams) {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // ── 기본 쿼리 ──────────────────────────────────────────
      // 에러 로그는 status = 'FAILED' 이거나, token_usages의 is_success = false 인 건을 조회
      let query = supabase
        .from("analyses")
        .select(
          `
          id,
          error_code,
          error_message,
          question_text,
          input_text,
          model_name,
          response_time_ms,
          created_at,
          users(email, name),
          token_usages(http_status, is_success)
        `,
          { count: "exact" }
        )
        .eq("status", "FAILED"); // FAILED 상태 분석들

      // 에러 종류 필터
      if (errorType !== "ALL") {
        if (errorType === "TIMEOUT") {
          query = query.eq("error_code", "TIMEOUT");
        } else if (errorType === "API_ERROR") {
          query = query.eq("error_code", "API_ERROR");
        } else if (errorType === "PARSE_ERROR") {
          query = query.eq("error_code", "PARSE_ERROR");
        } else if (errorType === "UNKNOWN") {
          query = query.eq("error_code", "UNKNOWN");
        }
        // HTTP_500 필터는 token_usages inner join 등 또는 클라이언트 필터링
      }

      query = query.order("created_at", { ascending: false });
      query = query.range(from, to);

      const { data, count, error: qErr } = await query;

      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        setIsLoading(false);
        return;
      }

      const rawLogs = (data ?? []) as any[];

      // 데이터 가공 및 클라이언트 사이드 HTTP 500 필터링
      let processed: ErrorLogItem[] = rawLogs.map((r) => {
        // token_usages 중 첫 번째 http_status 값 추출
        const tokenLogs = r.token_usages ?? [];
        const httpStatus = tokenLogs.length > 0 ? tokenLogs[0].http_status : null;

        return {
          id: r.id,
          analysisId: r.id,
          userEmail: r.users?.email ?? null,
          userName: r.users?.name ?? null,
          errorCode: r.error_code ?? "UNKNOWN",
          errorMessage: r.error_message ?? null,
          httpStatus,
          modelName: r.model_name ?? null,
          responseTimeMs: r.response_time_ms ?? null,
          createdAt: r.created_at,
          questionText: r.question_text ?? "",
          inputText: r.input_text ?? "",
        };
      });

      // HTTP_500 에러 클라이언트 필터링
      if (errorType === "HTTP_500") {
        processed = processed.filter((log) => log.httpStatus === 500);
      }

      // 검색 필터링 (에러 메시지 및 이메일)
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        processed = processed.filter(
          (log) =>
            log.errorMessage?.toLowerCase().includes(term) ||
            log.userEmail?.toLowerCase().includes(term) ||
            log.errorCode?.toLowerCase().includes(term)
        );
      }

      setLogs(processed);
      setTotal(count ?? 0);
      setIsLoading(false);
      setLastRefreshed(new Date());
    };

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [search, errorType, page, pageSize, tick]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { logs, total, totalPages, isLoading, error, refresh, lastRefreshed };
}
