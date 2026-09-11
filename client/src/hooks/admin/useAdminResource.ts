import { useCallback, useEffect, useRef, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export type AsyncState<T> = { data: T | null; isLoading: boolean; error: string | null };

/**
 * 관리자 스냅샷 자원 하나(대시보드·AI 사용량·퍼널). 다시 불러오는 동안 이전 데이터를 유지하고,
 * 실패하면 fallback(있으면)으로 되돌린다. pollMs 를 주면 그 주기로 자동 갱신한다.
 */
export function useAdminResource<T, TRaw = T>(
  url: string,
  options: {
    /** 응답을 화면용 데이터로 바꾼다. 생략하면 응답 그대로. */
    select?: (raw: TRaw) => T;
    /** 첫 렌더와 실패 시 보여 줄 데이터. */
    fallback?: () => T;
    pollMs?: number | null;
    errorMessage: string;
    /** 첫 성공 전에도 "갱신" 라벨을 보여 주려면 Date 를 넘긴다. */
    initialLastRefreshed?: Date | null;
  },
) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<AsyncState<T>>(() => ({
    data: options.fallback ? options.fallback() : null,
    isLoading: true,
    error: null,
  }));
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(options.initialLastRefreshed ?? null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState((previous) => ({ ...previous, isLoading: true, error: null }));
      try {
        const raw = await adminApiFetch<TRaw>(url);
        const { select } = optionsRef.current;
        const data = select ? select(raw) : (raw as unknown as T);
        if (cancelled) return;
        setState({ data, isLoading: false, error: null });
        setLastRefreshed(new Date());
      } catch (cause) {
        if (cancelled) return;
        const { fallback, errorMessage } = optionsRef.current;
        setState({
          data: fallback ? fallback() : null,
          isLoading: false,
          error: cause instanceof Error ? cause.message : errorMessage,
        });
      }
    };

    void load();
    const pollMs = optionsRef.current.pollMs;
    const interval = pollMs ? setInterval(load, pollMs) : null;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [url, tick]);

  return { ...state, refresh, lastRefreshed };
}
