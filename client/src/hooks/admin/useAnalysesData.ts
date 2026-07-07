import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입
// ============================================================

export type AnalysisStatus = "ALL" | "PENDING" | "SUCCESS" | "FAILED";
export type AnalysisSortField =
  | "created_at"
  | "response_time_ms"
  | "ai_score";
export type SortDir = "asc" | "desc";

export interface AnalysisRow {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error_code: string | null;
  model_name: string | null;
  model_provider: string | null;
  ai_score: number | null;
  response_time_ms: number | null;
  total_chars: number | null;
  created_at: string;
  // 집계
  total_tokens: number;
  total_cost: number;
  // 관계
  user_email: string | null;
  user_name: string | null;
  project_title: string | null;
  project_company: string | null;
}

export interface UseAnalysesDataParams {
  search: string;           // 이메일 검색
  status: AnalysisStatus;
  model: string;            // 'ALL' or model_name
  sortField: AnalysisSortField;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

// ============================================================
// 훅: 분석 목록
// ============================================================

export function useAnalysesData({
  search,
  status,
  model,
  sortField,
  sortDir,
  page,
  pageSize,
}: UseAnalysesDataParams) {
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetch = async () => {
      setIsLoading(true);
      setError(null);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("analyses")
        .select(
          `
          id,
          status,
          error_code,
          model_name,
          model_provider,
          ai_score,
          response_time_ms,
          total_chars,
          created_at,
          users(email, name),
          projects(title, company),
          token_usages(total_tokens, cost)
        `,
          { count: "exact" }
        );

      // 상태 필터
      if (status !== "ALL") {
        query = query.eq("status", status);
      }

      // 모델 필터
      if (model !== "ALL") {
        query = query.eq("model_name", model);
      }

      // 이메일 검색: users 테이블 필터는 클라이언트에서 처리
      // Supabase에서 embedded 테이블 필터는 제한적이므로
      // 검색 시 ilike 적용 (email은 analyses 테이블에 없어서 사용자 입력으로 별도 처리)
      // → 실제로는 ilike 필터를 users.email 기준으로 하면 좋지만,
      //   Supabase JS SDK에서 embedded 컬럼 필터는 지원되지 않음
      //   대안: 검색어가 있을 때는 서버측 RPC를 사용하거나
      //         전체를 가져와서 클라이언트 필터링 (현재 페이지 범위 내)
      // 현재 구현: search가 있을 때 model_provider 무시하고 전체 쿼리 후 클라이언트 필터

      // 정렬
      if (sortField === "created_at" || sortField === "response_time_ms" || sortField === "ai_score") {
        query = query.order(sortField, {
          ascending: sortDir === "asc",
          nullsFirst: false,
        });
      }

      query = query.range(from, to);

      const { data, count, error: qErr } = await query;

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setIsLoading(false);
        return;
      }

      const rawRows = (data ?? []) as any[];

      // 집계 + 검색 필터 (email 클라이언트 필터)
      let processed: AnalysisRow[] = rawRows.map((r) => ({
        id: r.id,
        status: r.status,
        error_code: r.error_code ?? null,
        model_name: r.model_name ?? null,
        model_provider: r.model_provider ?? null,
        ai_score: r.ai_score ?? null,
        response_time_ms: r.response_time_ms ?? null,
        total_chars: r.total_chars ?? null,
        created_at: r.created_at,
        total_tokens: (r.token_usages ?? []).reduce(
          (s: number, t: any) => s + (t.total_tokens ?? 0),
          0
        ),
        total_cost: (r.token_usages ?? []).reduce(
          (s: number, t: any) => s + (t.cost ?? 0),
          0
        ),
        user_email: (r.users as any)?.email ?? null,
        user_name: (r.users as any)?.name ?? null,
        project_title: (r.projects as any)?.title ?? null,
        project_company: (r.projects as any)?.company ?? null,
      }));

      // 클라이언트 이메일 검색 (embedded 필터 한계 대응)
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        processed = processed.filter(
          (r) =>
            r.user_email?.toLowerCase().includes(term) ||
            r.user_name?.toLowerCase().includes(term) ||
            r.project_title?.toLowerCase().includes(term)
        );
      }

      setRows(processed);
      setTotal(count ?? 0);
      setIsLoading(false);
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [search, status, model, sortField, sortDir, page, pageSize, tick]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return { rows, total, totalPages, isLoading, error, refresh };
}

// ============================================================
// 훅: 사용 가능한 모델 목록 (필터 드롭다운용)
// ============================================================

export function useAvailableModels() {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    supabase
      .from("analyses")
      .select("model_name")
      .not("model_name", "is", null)
      .limit(200)
      .then(({ data }) => {
        const unique = Array.from(new Set((data ?? []).map((r: any) => r.model_name as string))).sort();
        setModels(unique);
      });
  }, []);

  return models;
}
