import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserSortField, SortDir } from "@/hooks/admin/useUsersData";

interface UsersFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  sortField: UserSortField;
  onSortFieldChange: (v: UserSortField) => void;
  sortDir: SortDir;
  onSortDirChange: (v: SortDir) => void;
  total: number;
  isLoading: boolean;
}

const SORT_FIELD_OPTIONS: { value: UserSortField; label: string }[] = [
  { value: "created_at", label: "가입일" },
  { value: "updated_at", label: "최근 활성" },
  { value: "email", label: "이메일" },
  { value: "name", label: "이름" },
];

/**
 * UsersFilters
 *
 * 검색 + 정렬 컨트롤 바.
 * - 이메일/이름 통합 검색
 * - 정렬 기준 및 방향 선택
 * - 총 사용자 수 표시
 */
export function UsersFilters({
  search,
  onSearchChange,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirChange,
  total,
  isLoading,
}: UsersFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* 검색 */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          id="users-search"
          placeholder="이메일 또는 이름 검색..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* 총 사용자 수 */}
        {!isLoading && (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            총 {total.toLocaleString("ko-KR")}명
          </span>
        )}

        {/* 정렬 기준 */}
        <Select
          value={sortField}
          onValueChange={(v) => onSortFieldChange(v as UserSortField)}
        >
          <SelectTrigger id="users-sort-field" className="h-9 w-[110px]">
            <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_FIELD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 정렬 방향 */}
        <Select
          value={sortDir}
          onValueChange={(v) => onSortDirChange(v as SortDir)}
        >
          <SelectTrigger id="users-sort-dir" className="h-9 w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">내림차순</SelectItem>
            <SelectItem value="asc">오름차순</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
