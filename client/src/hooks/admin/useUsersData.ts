import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/adminApi";

export type UserSortField = "created_at" | "email" | "name" | "updated_at";
export type SortDir = "asc" | "desc";
export interface AdminUserRow { id: string; email: string; name: string | null; profile_image: string | null; provider: string | null; role: string; created_at: string; updated_at: string; analysis_count: number; project_count: number; payment_count: number; }
export interface UseUsersDataParams { search: string; sortField: UserSortField; sortDir: SortDir; page: number; pageSize: number; }
interface UseUsersDataResult { users: AdminUserRow[]; total: number; totalPages: number; isLoading: boolean; error: string | null; refresh: () => void; }

export function useUsersData({ search, sortField, sortDir, page, pageSize }: UseUsersDataParams): UseUsersDataResult {
  const [users, setUsers] = useState<AdminUserRow[]>([]); const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true); setError(null);
      try {
        const params = new URLSearchParams({ search, sortField, sortDir, page: String(page), pageSize: String(pageSize) });
        const data = await adminApiFetch<{ users: AdminUserRow[]; total: number }>(`/api/admin/users?${params}`);
        if (!cancelled) { setUsers(data.users); setTotal(data.total); setIsLoading(false); }
      } catch (cause) { if (!cancelled) { setError(cause instanceof Error ? cause.message : "사용자 데이터를 불러오지 못했습니다."); setIsLoading(false); } }
    };
    load(); return () => { cancelled = true; };
  }, [page, pageSize, search, sortDir, sortField, tick]);
  return { users, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), isLoading, error, refresh };
}
