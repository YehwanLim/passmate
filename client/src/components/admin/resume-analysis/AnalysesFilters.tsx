import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { AnalysisStatus, AnalysisSortField, SortDir } from "@/hooks/admin/useAnalysesData";

interface AnalysesFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: AnalysisStatus;
  onStatusChange: (v: AnalysisStatus) => void;
  model: string;
  onModelChange: (v: string) => void;
  models: string[];           // 사용 가능한 모델 목록
  sortField: AnalysisSortField;
  onSortFieldChange: (v: AnalysisSortField) => void;
  sortDir: SortDir;
  onSortDirChange: (v: SortDir) => void;
  total: number;
  isLoading: boolean;
}

const STATUS_OPTIONS: { value: AnalysisStatus; label: string }[] = [
  { value: "ALL", label: "전체 상태" },
  { value: "SUCCESS", label: "✅ 완료" },
  { value: "FAILED", label: "❌ 실패" },
  { value: "PENDING", label: "⏳ 대기" },
];

const SORT_OPTIONS: { value: AnalysisSortField; label: string }[] = [
  { value: "created_at", label: "분석 일시" },
  { value: "response_time_ms", label: "응답시간" },
  { value: "ai_score", label: "AI 점수" },
];

export function AnalysesFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  model,
  onModelChange,
  models,
  sortField,
  onSortFieldChange,
  sortDir,
  onSortDirChange,
  total,
  isLoading,
}: AnalysesFiltersProps) {
  const hasFilter = status !== "ALL" || model !== "ALL" || search.trim();

  return (
    <div className="flex flex-col gap-3">
      {/* 상단: 검색 + 필터 + 정렬 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 검색 */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="analyses-search"
            placeholder="이메일, 이름, 프로젝트명..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* 상태 필터 */}
        <Select
          value={status}
          onValueChange={(v) => onStatusChange(v as AnalysisStatus)}
        >
          <SelectTrigger id="analyses-status-filter" className="h-9 w-[130px]">
            <SlidersHorizontal className="size-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 모델 필터 */}
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger id="analyses-model-filter" className="h-9 w-[160px]">
            <SelectValue placeholder="전체 모델" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">전체 모델</SelectItem>
            {models.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 정렬 */}
        <div className="flex items-center gap-1 ml-auto">
          <Select
            value={sortField}
            onValueChange={(v) => onSortFieldChange(v as AnalysisSortField)}
          >
            <SelectTrigger id="analyses-sort-field" className="h-9 w-[120px]">
              <ArrowUpDown className="size-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortDir}
            onValueChange={(v) => onSortDirChange(v as SortDir)}
          >
            <SelectTrigger id="analyses-sort-dir" className="h-9 w-[84px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">내림차순</SelectItem>
              <SelectItem value="asc">오름차순</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 결과 수 + 활성 필터 뱃지 */}
      <div className="flex items-center gap-2 text-sm">
        {!isLoading && (
          <span className="text-muted-foreground">
            총 {total.toLocaleString("ko-KR")}건
          </span>
        )}
        {status !== "ALL" && (
          <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => onStatusChange("ALL")}>
            상태: {STATUS_OPTIONS.find((o) => o.value === status)?.label}
            <span className="opacity-60">×</span>
          </Badge>
        )}
        {model !== "ALL" && (
          <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => onModelChange("ALL")}>
            모델: {model}
            <span className="opacity-60">×</span>
          </Badge>
        )}
        {search.trim() && (
          <Badge variant="secondary" className="text-xs gap-1 cursor-pointer" onClick={() => onSearchChange("")}>
            검색: {search}
            <span className="opacity-60">×</span>
          </Badge>
        )}
      </div>
    </div>
  );
}
