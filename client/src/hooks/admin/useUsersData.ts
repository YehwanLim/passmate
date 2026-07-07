import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ============================================================
// 타입
// ============================================================

export type UserSortField = "created_at" | "email" | "name" | "updated_at";
export type SortDir = "asc" | "desc";

/** users 테이블 + 집계 컬럼 */
export interface AdminUserRow {
  id: string;
  email: string;
  name: string | null;
  profile_image: string | null;
  provider: string | null;
  role: string;
  created_at: string;
  updated_at: string;
  /** analyses 테이블 COUNT (Supabase 임베드) */
  analysis_count: number;
  /** projects 테이블 COUNT */
  project_count: number;
}

export interface UseUsersDataParams {
  search: string;
  sortField: UserSortField;
  sortDir: SortDir;
  page: number;
  pageSize: number;
}

interface UseUsersDataResult {
  users: AdminUserRow[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// ============================================================
// 훅
// ============================================================

/**
 * useUsersData
 *
 * 관리자 Users 페이지 데이터 훅.
 * - 검색 (email + name)
 * - 정렬 (created_at, email, name, updated_at)
 * - 페이지네이션
 * - 분석 횟수, 프로젝트 수 집계
 *
 * @note RLS: admin role 사용자가 모든 users를 SELECT할 수 있어야 합니다.
 */
export function useUsersData({
  search,
  sortField,
  sortDir,
  page,
  pageSize,
}: UseUsersDataParams): UseUsersDataResult {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async () => {
      setIsLoading(true);
      setError(null);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // ── 1) 유저 목록 + 집계 ─────────────────────────────
      let query = supabase
        .from("users")
        .select(
          `
          id,
          email,
          name,
          profile_image,
          provider,
          role,
          created_at,
          updated_at,
          analyses(count),
          projects(count)
        `,
          { count: "exact" }
        );

      // 검색 필터
      if (search.trim()) {
        const term = search.trim();
        query = query.or(`email.ilike.%${term}%,name.ilike.%${term}%`);
      }

      // 정렬
      query = query.order(sortField, { ascending: sortDir === "asc" });

      // 페이지네이션
      query = query.range(from, to);

      const { data, count, error: queryError } = await query;

      if (cancelled) return;

      if (queryError) {
        setError(queryError.message);
        setIsLoading(false);
        return;
      }

      // Supabase 임베드 집계 변환
      // analyses 필드는 [{ count: N }] 형태로 반환됨
      const rows: AdminUserRow[] = (data ?? []).map((row: any) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        profile_image: row.profile_image ?? null,
        provider: row.provider ?? null,
        role: row.role ?? "user",
        created_at: row.created_at,
        updated_at: row.updated_at,
        analysis_count: Array.isArray(row.analyses)
          ? (row.analyses[0]?.count ?? 0)
          : 0,
        project_count: Array.isArray(row.projects)
          ? (row.projects[0]?.count ?? 0)
          : 0,
      }));

      setUsers(rows);
      setTotal(count ?? 0);
      setIsLoading(false);
    };

    fetchUsers();
    return () => { cancelled = true; };
  }, [search, sortField, sortDir, page, pageSize, tick]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return { users, total, totalPages, isLoading, error, refresh };
}
