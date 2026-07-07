import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRoleBadge } from "./UserRoleBadge";
import { FileText, FolderOpen, ChevronRight } from "lucide-react";
import type { AdminUserRow } from "@/hooks/admin/useUsersData";

// ============================================================
// 유틸
// ============================================================

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 30) return `${days}일 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

function getInitials(name: string | null, email: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

// ============================================================
// 로딩 스켈레톤
// ============================================================

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full flex-shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </TableCell>
      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-10" /></TableCell>
      <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-10" /></TableCell>
      <TableCell><Skeleton className="size-4" /></TableCell>
    </TableRow>
  );
}

// ============================================================
// Component
// ============================================================

interface UsersTableProps {
  users: AdminUserRow[];
  isLoading: boolean;
}

/**
 * UsersTable
 *
 * 사용자 목록 테이블.
 *
 * 표시 컬럼:
 * - 사용자 (아바타 + 이름 + 이메일)
 * - 역할 (admin / user)
 * - 가입일 (항상 표시)
 * - 최근 활성 (md 이상)
 * - 분석 수 (lg 이상)
 * - 프로젝트 수 (xl 이상)
 * - 상세 보기 링크
 *
 * 현재 DB에서 구현 불가 → 표시 안 함:
 * - 구독 플랜 (payments 테이블 없음)
 * - 계정 상태 (is_active 컬럼 없음)
 * - 정확한 마지막 로그인 (auth.users 접근 불가)
 */
export function UsersTable({ users, isLoading }: UsersTableProps) {
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[260px]">사용자</TableHead>
            <TableHead className="w-[90px]">역할</TableHead>
            <TableHead className="hidden md:table-cell w-[110px]">가입일</TableHead>
            <TableHead className="hidden lg:table-cell w-[110px]">최근 활성</TableHead>
            <TableHead className="hidden lg:table-cell w-[80px] text-right">분석</TableHead>
            <TableHead className="hidden xl:table-cell w-[80px] text-right">프로젝트</TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
          ) : users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-sm">
                검색 결과가 없습니다.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {/* 사용자 */}
                <TableCell>
                  <Link href={`/admin/users/${user.id}`}>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 flex-shrink-0">
                        <AvatarImage
                          src={user.profile_image ?? undefined}
                          alt={user.name ?? user.email}
                        />
                        <AvatarFallback className="text-[11px] font-semibold bg-primary/10 text-primary">
                          {getInitials(user.name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        {user.name && (
                          <p className="text-sm font-medium truncate leading-tight">
                            {user.name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate leading-tight">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </Link>
                </TableCell>

                {/* 역할 */}
                <TableCell>
                  <UserRoleBadge role={user.role} />
                </TableCell>

                {/* 가입일 */}
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {formatDate(user.created_at)}
                </TableCell>

                {/* 최근 활성 (updated_at proxy) */}
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  <span title={formatDate(user.updated_at)}>
                    {relativeTime(user.updated_at)}
                  </span>
                </TableCell>

                {/* 분석 횟수 */}
                <TableCell className="hidden lg:table-cell text-right">
                  <span className="inline-flex items-center gap-1 text-sm">
                    <FileText className="size-3 text-muted-foreground" />
                    {user.analysis_count.toLocaleString("ko-KR")}
                  </span>
                </TableCell>

                {/* 프로젝트 수 */}
                <TableCell className="hidden xl:table-cell text-right">
                  <span className="inline-flex items-center gap-1 text-sm">
                    <FolderOpen className="size-3 text-muted-foreground" />
                    {user.project_count.toLocaleString("ko-KR")}
                  </span>
                </TableCell>

                {/* 상세 링크 */}
                <TableCell>
                  <Link href={`/admin/users/${user.id}`}>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
