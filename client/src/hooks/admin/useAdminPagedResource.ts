import { useCallback, useEffect, useRef, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

/**
 * 관리자 목록 자원 하나(사용자·로그·분석·피드백). 검색/정렬/페이지 파라미터가 바뀌거나
 * refresh() 를 부르면 다시 불러온다. 응답에서 행과 총계를 꺼내는 일은 select 가 한다.
 */
export function useAdminPagedResource<TRow, TData>(
  path: string,
  params: Record<string, string | number | boolean>,
  pageSize: number,
  options: {
    select: (data: TData) => { rows: TRow[]; total: number };
    errorMessage: string;
    /** 실패 시 행을 비운다(기본은 이전 행 유지). */
    resetOnError?: boolean;
  },
) {
  const query = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)])),
  ).toString();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [rows, setRows] = useState<TRow[]>([]);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState<TData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const payload = await adminApiFetch<TData>(`${path}?${query}`);
        if (cancelled) return;
        const selected = optionsRef.current.select(payload);
        setData(payload);
        setRows(selected.rows);
        setTotal(selected.total);
        setLastRefreshed(new Date());
      } catch (cause) {
        if (cancelled) return;
        if (optionsRef.current.resetOnError) {
          setRows([]);
          setTotal(0);
        }
        setError(cause instanceof Error ? cause.message : optionsRef.current.errorMessage);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [path, query, tick]);

  return {
    rows,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    data,
    isLoading,
    error,
    refresh,
    lastRefreshed,
  };
}
