import { useState, useEffect } from "react";
import { adminApiFetch } from "@/lib/adminApi";
import { useAdminPagedResource } from "./useAdminPagedResource";

// ============================================================
// 타입
// ============================================================

export type AnalysisStatus = "ALL" | "PENDING" | "SUCCESS" | "FAILED";
export type AnalysisSortField =
  | "created_at"
  | "response_time_ms";
export type SortDir = "asc" | "desc";

export interface AnalysisRow {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error_code: string | null;
  model_name: string | null;
  model_provider: string | null;
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
  project_job_keyword: string | null;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function normalizeAnalysisRow(r: any): AnalysisRow {
  const user = firstRelation(r.users);
  const project = firstRelation(r.projects);

  return {
    id: r.id,
    status: r.status,
    error_code: r.error_code ?? null,
    model_name: r.model_name ?? null,
    model_provider: r.model_provider ?? null,
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
    user_email: user?.email ?? null,
    user_name: user?.name ?? null,
    project_title: project?.title ?? null,
    project_company: project?.company ?? null,
    project_job_keyword: project?.job_keyword ?? null,
  };
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
  const { rows, total, totalPages, isLoading, error, refresh } = useAdminPagedResource<AnalysisRow, { rows?: AnalysisRow[]; total?: number }>(
    "/api/admin/resume-analysis",
    { search, status, model, sortField, sortDir, page, pageSize },
    pageSize,
    {
      select: (payload) => {
        const processed = (payload.rows ?? []) as AnalysisRow[];
        return { rows: processed, total: payload.total ?? processed.length };
      },
      errorMessage: "분석 목록을 불러오지 못했습니다.",
      resetOnError: true,
    },
  );
  return { rows, total, totalPages, isLoading, error, refresh };
}

// ============================================================
// 훅: 사용 가능한 모델 목록 (필터 드롭다운용)
// ============================================================

export function useAvailableModels() {
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => {
    adminApiFetch<{ models?: string[] }>("/api/admin/resume-analysis?page=1&pageSize=1")
      .then((payload) => setModels(payload.models ?? []))
      .catch(() => setModels([]));
  }, []);

  return models;
}
