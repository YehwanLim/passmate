import { useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";
import type { PurchaseProduct } from "@/lib/pricing";

export interface UserDetailAnalysis { id: string; status: "PENDING" | "SUCCESS" | "FAILED"; model_name: string | null; model_provider: string | null; ai_score: number | null; created_at: string; project: { title: string; company: string | null } | null; token_usages: Array<{ total_tokens: number; cost: number | null }>; }
export interface UserDetailFeedback { id: string; rating: "THUMBS_UP" | "THUMBS_DOWN"; comment: string | null; created_at: string; }
export interface UserDetailPayment { id: string; product: PurchaseProduct | null; credits_granted: number; provider_payment_id: string; created_at: string; }
export interface UserDetailPendingPurchase { id: string; product: PurchaseProduct; status: "PENDING" | "CANCELLED"; created_at: string; }
export interface UserDetail { id: string; email: string; name: string | null; profile_image: string | null; provider: string | null; role: string; created_at: string; updated_at: string; analysis_count: number; project_count: number; feedback_count: number; total_tokens: number; total_ai_cost: number; analyses: UserDetailAnalysis[]; feedbacks: UserDetailFeedback[]; payments: UserDetailPayment[]; pending_purchases: UserDetailPendingPurchase[]; }
interface UseUserDetailResult { user: UserDetail | null; isLoading: boolean; error: string | null; }

export function useUserDetail(userId: string): UseUserDetailResult {
  const [user, setUser] = useState<UserDetail | null>(null); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return; let cancelled = false;
    adminApiFetch<UserDetail>(`/api/admin/users/${encodeURIComponent(userId)}`)
      .then((data) => { if (!cancelled) { setUser(data); setError(null); setIsLoading(false); } })
      .catch((cause) => { if (!cancelled) { setError(cause instanceof Error ? cause.message : "사용자 데이터를 불러오지 못했습니다."); setIsLoading(false); } });
    return () => { cancelled = true; };
  }, [userId]);
  return { user, isLoading, error };
}
