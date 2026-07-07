import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입
// ============================================================

export interface AnalysisDetail {
  // 기본
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  error_code: string | null;
  error_message: string | null;

  // 입력
  question_text: string;
  input_text: string;
  total_chars: number | null;

  // AI 출력
  ai_response_json: unknown;
  ai_score: number | null;

  // 모델
  model_name: string | null;
  model_provider: string | null;
  prompt_version: string;
  response_time_ms: number | null;

  // 메타
  created_at: string;

  // 관계
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  project: {
    id: string;
    title: string;
    company: string | null;
    job_keyword: string | null;
  } | null;
  prompt_template: {
    id: string;
    name: string;
    version: string;
    system_prompt: string;
    user_template: string | null;
    temperature: number | null;
    max_tokens: number | null;
  } | null;
  token_usages: Array<{
    id: string;
    call_type: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number | null;
    latency_ms: number | null;
    is_success: boolean;
  }>;
}

// ============================================================
// 훅
// ============================================================

export function useAnalysisDetail(analysisId: string) {
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;
    let cancelled = false;

    const fetch = async () => {
      setIsLoading(true);
      setError(null);

      const { data, error: qErr } = await supabase
        .from("analyses")
        .select(
          `
          id,
          status,
          error_code,
          error_message,
          question_text,
          input_text,
          total_chars,
          ai_response_json,
          ai_score,
          model_name,
          model_provider,
          prompt_version,
          response_time_ms,
          created_at,
          users(id, email, name),
          projects(id, title, company, job_keyword),
          prompt_templates(id, name, version, system_prompt, user_template, temperature, max_tokens),
          token_usages(id, call_type, prompt_tokens, completion_tokens, total_tokens, cost, latency_ms, is_success)
        `
        )
        .eq("id", analysisId)
        .single();

      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        setIsLoading(false);
        return;
      }

      const r = data as any;

      setDetail({
        id: r.id,
        status: r.status,
        error_code: r.error_code ?? null,
        error_message: r.error_message ?? null,
        question_text: r.question_text,
        input_text: r.input_text,
        total_chars: r.total_chars ?? null,
        ai_response_json: r.ai_response_json,
        ai_score: r.ai_score ?? null,
        model_name: r.model_name ?? null,
        model_provider: r.model_provider ?? null,
        prompt_version: r.prompt_version,
        response_time_ms: r.response_time_ms ?? null,
        created_at: r.created_at,
        user: r.users
          ? { id: r.users.id, email: r.users.email, name: r.users.name ?? null }
          : null,
        project: r.projects
          ? {
              id: r.projects.id,
              title: r.projects.title,
              company: r.projects.company ?? null,
              job_keyword: r.projects.job_keyword ?? null,
            }
          : null,
        prompt_template: r.prompt_templates
          ? {
              id: r.prompt_templates.id,
              name: r.prompt_templates.name,
              version: r.prompt_templates.version,
              system_prompt: r.prompt_templates.system_prompt,
              user_template: r.prompt_templates.user_template ?? null,
              temperature: r.prompt_templates.temperature ?? null,
              max_tokens: r.prompt_templates.max_tokens ?? null,
            }
          : null,
        token_usages: (r.token_usages ?? []).map((t: any) => ({
          id: t.id,
          call_type: t.call_type,
          prompt_tokens: t.prompt_tokens,
          completion_tokens: t.completion_tokens,
          total_tokens: t.total_tokens,
          cost: t.cost ?? null,
          latency_ms: t.latency_ms ?? null,
          is_success: t.is_success,
        })),
      });

      setIsLoading(false);
    };

    fetch();
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  return { detail, isLoading, error };
}
