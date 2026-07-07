import { useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { UsersFilters } from "@/components/admin/users/UsersFilters";
import { UsersTable } from "@/components/admin/users/UsersTable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { useUsersData, type UserSortField, type SortDir } from "@/hooks/admin/useUsersData";
import { AlertCircle } from "lucide-react";

const PAGE_SIZE = 20;

// ============================================================
// 페이지네이션 숫자 계산
// ============================================================

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);

  return pages;
}

// ============================================================
// UsersPage
// ============================================================

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

  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <AdminPageHeader
        title="Users"
        description="가입 사용자 목록을 조회하고 관리합니다."
      />

      {/* 에러 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page > 1) setPage(page - 1);
                }}
                className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                aria-disabled={page <= 1}
              />
            </PaginationItem>

            {pageNumbers.map((p, i) =>
              p === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => {
                      e.preventDefault();
                      setPage(p);
                    }}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
                className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                aria-disabled={page >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

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
