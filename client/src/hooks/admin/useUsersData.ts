import { useAdminPagedResource } from "./useAdminPagedResource";

export type UserSortField = "created_at" | "email" | "name" | "updated_at";
export type SortDir = "asc" | "desc";
export interface AdminUserRow { id: string; email: string; name: string | null; profile_image: string | null; provider: string | null; role: string; created_at: string; updated_at: string; analysis_count: number; project_count: number; payment_count: number; }
export interface UseUsersDataParams { search: string; sortField: UserSortField; sortDir: SortDir; page: number; pageSize: number; }
interface UseUsersDataResult { users: AdminUserRow[]; total: number; totalPages: number; isLoading: boolean; error: string | null; refresh: () => void; }

export function useUsersData({ search, sortField, sortDir, page, pageSize }: UseUsersDataParams): UseUsersDataResult {
  const { rows: users, total, totalPages, isLoading, error, refresh } = useAdminPagedResource<AdminUserRow, { users: AdminUserRow[]; total: number }>(
    "/api/admin/users",
    { search, sortField, sortDir, page, pageSize },
    pageSize,
    { select: (data) => ({ rows: data.users, total: data.total }), errorMessage: "사용자 데이터를 불러오지 못했습니다." },
  );
  return { users, total, totalPages, isLoading, error, refresh };
}
