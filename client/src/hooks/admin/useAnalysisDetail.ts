import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export interface AnalysisDetail {
  id: string; project_id: string; status: "PENDING" | "SUCCESS" | "FAILED"; error_code: string | null; error_message: string | null;
  question_text: string; input_text: string; total_chars: number | null; ai_response_json: unknown; ai_score: number | null;
  model_name: string | null; model_provider: string | null; prompt_version: string; response_time_ms: number | null; created_at: string;
  user: { id: string; email: string; name: string | null } | null;
  project: { id: string; title: string; company: string | null; job_keyword: string | null } | null;
  project_analyses: Array<{ id: string; status: "PENDING" | "SUCCESS" | "FAILED"; question_text: string; input_text: string; total_chars: number | null; ai_response_json: unknown; ai_score: number | null; created_at: string; }>;
  prompt_template: { id: string; name: string; version: string; system_prompt: string; user_template: string | null; temperature: number | null; max_tokens: number | null } | null;
  token_usages: Array<{ id: string; call_type: string; prompt_tokens: number; completion_tokens: number; total_tokens: number; cost: number | null; latency_ms: number | null; is_success: boolean; }>;
}

export function useAnalysisDetail(analysisId: string) {
  const [detail, setDetail] = useState<AnalysisDetail | null>(null); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!analysisId) { setDetail(null); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    adminApiFetch<AnalysisDetail>(`/api/admin/analyses/${encodeURIComponent(analysisId)}`)
      .then((data) => { if (!cancelled) { setDetail(data); setError(null); setIsLoading(false); } })
      .catch((cause) => { if (!cancelled) { setError(cause instanceof Error ? cause.message : "분석 데이터를 불러오지 못했습니다."); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [analysisId]);
  return { detail, isLoading, error };
}
