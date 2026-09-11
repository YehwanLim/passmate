import { useState, useCallback } from "react";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminPagination } from "@/components/admin/shared/AdminPagination";
import { UsersFilters } from "@/components/admin/users/UsersFilters";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { useUsersData, type UserSortField, type SortDir } from "@/hooks/admin/useUsersData";

const PAGE_SIZE = 20;

/**
 * UsersPage
 *
 * 관리자 사용자 목록 페이지.
 * - 이메일/이름 통합 검색
 * - 가입일/최근활성/이메일/이름 정렬
 * - 20건 단위 페이지네이션
 * - 사용자 행 클릭 시 /admin/users/:id 이동
 */
export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<UserSortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  // 검색 시 첫 페이지로 리셋
  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const { users, total, totalPages, isLoading, error } = useUsersData({
    search,
    sortField,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <AdminPageHeader
        title="Users"
        description="가입 사용자 목록을 조회하고 관리합니다."
      />

      <AdminErrorAlert message={error} />

      {/* 필터 */}
      <UsersFilters
        search={search}
        onSearchChange={handleSearchChange}
        sortField={sortField}
        onSortFieldChange={(v) => { setSortField(v); setPage(1); }}
        sortDir={sortDir}
        onSortDirChange={(v) => { setSortDir(v); setPage(1); }}
        total={total}
        isLoading={isLoading}
      />

      {/* 테이블 */}
      <UsersTable users={users} isLoading={isLoading} />

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {/* 현재 페이지 정보 */}
      {!isLoading && total > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}번째 / 총{" "}
          {total.toLocaleString("ko-KR")}명
        </p>
      )}
    </div>
  );
}
