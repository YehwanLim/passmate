import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입
// ============================================================

export interface UserDetailAnalysis {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  model_name: string | null;
  model_provider: string | null;
  ai_score: number | null;
  created_at: string;
  project: { title: string; company: string | null } | null;
  token_usages: Array<{
    total_tokens: number;
    cost: number | null;
  }>;
}

export interface UserDetailFeedback {
  id: string;
  rating: "THUMBS_UP" | "THUMBS_DOWN";
  comment: string | null;
  created_at: string;
}

export interface UserDetail {
  // 기본 정보
  id: string;
  email: string;
  name: string | null;
  profile_image: string | null;
  provider: string | null;
  role: string;
  created_at: string;
  updated_at: string;

  // 집계
  analysis_count: number;
  project_count: number;
  feedback_count: number;
  total_tokens: number;
  total_ai_cost: number;

  // 목록
  analyses: UserDetailAnalysis[];
  feedbacks: UserDetailFeedback[];
}

interface UseUserDetailResult {
  user: UserDetail | null;
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// 훅
// ============================================================

/**
 * useUserDetail
 *
 * 관리자 사용자 상세 페이지 데이터 훅.
 * - 기본 프로필
 * - 분석 이력 (최근 20건, 프로젝트 + 토큰 포함)
 * - 피드백 이력 (최근 10건)
 * - 누적 AI 비용 / 토큰 집계
 */
export function useUserDetail(userId: string): UseUserDetailResult {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const fetch = async () => {
      setIsLoading(true);
      setError(null);

      // ── 병렬 조회 ────────────────────────────────────────
      const [profileRes, analysesRes, feedbacksRes, tokenRes] =
        await Promise.all([
          // 1. 기본 프로필
          supabase
            .from("users")
            .select("id, email, name, avatar_url, role, created_at, updated_at")
            .eq("id", userId)
            .single(),

          // 2. 분석 이력 (최근 20건, 프로젝트 + 토큰 포함)
          supabase
            .from("analyses")
            .select(
              `
              id,
              status,
              model_name,
              model_provider,
              ai_score,
              created_at,
              projects(title, company),
              token_usages(total_tokens, cost)
            `
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20),

          // 3. 피드백 (최근 10건)
          supabase
            .from("feedbacks")
            .select("id, rating, comment, created_at")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(10),

          // 4. 토큰 집계 (전체)
          supabase
            .from("token_usages")
            .select("total_tokens, cost, analyses!inner(user_id)")
            .eq("analyses.user_id", userId),
        ]);

      if (cancelled) return;

      if (profileRes.error) {
        setError(profileRes.error.message);
        setIsLoading(false);
        return;
      }

      const profile = profileRes.data;
      const analyses = (analysesRes.data ?? []) as any[];
      const feedbacks = (feedbacksRes.data ?? []) as any[];
      const tokens = (tokenRes.data ?? []) as any[];

      // 토큰 집계
      const totalTokens = tokens.reduce(
        (sum: number, t: any) => sum + (t.total_tokens ?? 0),
        0
      );
      const totalAiCost = tokens.reduce(
        (sum: number, t: any) => sum + (t.cost ?? 0),
        0
      );

      // 분석 카운트 (limit 없이 별도 조회로 정확하게)
      const { count: analysisCount } = await supabase
        .from("analyses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const { count: projectCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      const { count: feedbackCount } = await supabase
        .from("feedbacks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);

      if (cancelled) return;

      const detail: UserDetail = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        profile_image: profile.avatar_url ?? null,
        provider: null,
        role: profile.role ?? "user",
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        analysis_count: analysisCount ?? 0,
        project_count: projectCount ?? 0,
        feedback_count: feedbackCount ?? 0,
        total_tokens: totalTokens,
        total_ai_cost: totalAiCost,
        analyses: analyses.map((a) => ({
          id: a.id,
          status: a.status,
          model_name: a.model_name,
          model_provider: a.model_provider,
          ai_score: a.ai_score,
          created_at: a.created_at,
          project: Array.isArray(a.projects) ? a.projects[0] ?? null : a.projects ?? null,
          token_usages: a.token_usages ?? [],
        })),
        feedbacks: feedbacks.map((f) => ({
          id: f.id,
          rating: f.rating,
          comment: f.comment,
          created_at: f.created_at,
        })),
      };

      setUser(detail);
      setIsLoading(false);
    };

    fetch();
    return () => { cancelled = true; };
  }, [userId]);

  return { user, isLoading, error };
}
