import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { MOCK_ADMIN_ANALYSIS_DETAIL } from "./mockResumeAnalysis";

// ============================================================
// 타입
// ============================================================

export interface AnalysisDetail {
  // 기본
  id: string;
  project_id: string;
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
  project_analyses: Array<{
    id: string;
    status: "PENDING" | "SUCCESS" | "FAILED";
    question_text: string;
    input_text: string;
    total_chars: number | null;
    ai_response_json: unknown;
    ai_score: number | null;
    created_at: string;
  }>;
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

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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

      if (analysisId.startsWith("mock-analysis-")) {
        const selectedProjectAnalysis =
          MOCK_ADMIN_ANALYSIS_DETAIL.project_analyses.find((analysis) => analysis.id === analysisId) ??
          MOCK_ADMIN_ANALYSIS_DETAIL.project_analyses[0];

        setDetail({
          ...MOCK_ADMIN_ANALYSIS_DETAIL,
          id: analysisId,
          question_text: selectedProjectAnalysis.question_text,
          input_text: selectedProjectAnalysis.input_text,
          total_chars: selectedProjectAnalysis.total_chars,
          ai_response_json: selectedProjectAnalysis.ai_response_json,
          created_at: selectedProjectAnalysis.created_at,
        });
        setIsLoading(false);
        return;
      }

      const { data, error: qErr } = await supabase
        .from("analyses")
        .select(
          `
          id,
          project_id,
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
        setDetail(MOCK_ADMIN_ANALYSIS_DETAIL);
        setError(null);
        setIsLoading(false);
        return;
      }

      const r = data as any;
      const user = firstRelation(r.users);
      const project = firstRelation(r.projects);
      const promptTemplate = firstRelation(r.prompt_templates);
      const { data: projectAnalysesData } = await supabase
        .from("analyses")
        .select(
          `
          id,
          status,
          question_text,
          input_text,
          total_chars,
          ai_response_json,
          ai_score,
          created_at
        `
        )
        .eq("project_id", r.project_id)
        .order("created_at", { ascending: false });

      const projectAnalyses = ((projectAnalysesData ?? []) as any[]).map(a => ({
        id: a.id,
        status: a.status,
        question_text: a.question_text,
        input_text: a.input_text,
        total_chars: a.total_chars ?? null,
        ai_response_json: a.ai_response_json,
        ai_score: a.ai_score ?? null,
        created_at: a.created_at,
      }));

      setDetail({
        id: r.id,
        project_id: r.project_id,
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
        user: user
          ? { id: user.id, email: user.email, name: user.name ?? null }
          : null,
        project: project
          ? {
              id: project.id,
              title: project.title,
              company: project.company ?? null,
              job_keyword: project.job_keyword ?? null,
            }
          : null,
        project_analyses:
          projectAnalyses.length > 0
            ? projectAnalyses
            : [
                {
                  id: r.id,
                  status: r.status,
                  question_text: r.question_text,
                  input_text: r.input_text,
                  total_chars: r.total_chars ?? null,
                  ai_response_json: r.ai_response_json,
                  ai_score: r.ai_score ?? null,
                  created_at: r.created_at,
                },
              ],
        prompt_template: promptTemplate
          ? {
              id: promptTemplate.id,
              name: promptTemplate.name,
              version: promptTemplate.version,
              system_prompt: promptTemplate.system_prompt,
              user_template: promptTemplate.user_template ?? null,
              temperature: promptTemplate.temperature ?? null,
              max_tokens: promptTemplate.max_tokens ?? null,
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
