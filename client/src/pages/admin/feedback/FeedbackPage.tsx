import { useCallback, useState } from "react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/shared/AdminStatCard";
import { FeedbackTable } from "@/components/admin/feedback/FeedbackTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  useFeedbackData,
  type FeedbackRatingFilter,
} from "@/hooks/admin/useFeedbackData";
import {
  AlertCircle,
  MessageSquare,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";

const PAGE_SIZE = 15;

function getPageNumbers(
  current: number,
  total: number
): (number | "ellipsis")[] {
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

const RATING_OPTIONS: { value: FeedbackRatingFilter; label: string }[] = [
  { value: "ALL", label: "전체 평가" },
  { value: "THUMBS_UP", label: "👍 만족" },
  { value: "THUMBS_DOWN", label: "👎 불만족" },
];

export default function FeedbackPage() {
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<FeedbackRatingFilter>("ALL");
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [page, setPage] = useState(1);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleRatingChange = useCallback((value: FeedbackRatingFilter) => {
    setRating(value);
    setPage(1);
  }, []);

  const handleCommentsOnlyChange = useCallback((value: boolean) => {
    setCommentsOnly(value);
    setPage(1);
  }, []);

  const {
    items,
    summary,
    total,
    totalPages,
    isLoading,
    error,
    refresh,
    lastRefreshed,
  } = useFeedbackData({
    search,
    rating,
    commentsOnly,
    page,
    pageSize: PAGE_SIZE,
  });

  const pageNumbers = getPageNumbers(page, totalPages);
  const ratedTotal = summary.thumbsUp + summary.thumbsDown;
  const satisfactionLabel =
    ratedTotal > 0
      ? `만족률 ${Math.round((summary.thumbsUp / ratedTotal) * 100)}%`
      : undefined;
  const refreshLabel = `${lastRefreshed.getHours().toString().padStart(2, "0")}:${lastRefreshed
    .getMinutes()
    .toString()
    .padStart(2, "0")} 갱신`;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Feedback"
        description="리포트에 남은 사용자 평가와 코멘트를 확인합니다."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {refreshLabel}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={isLoading}
              className="gap-1.5"
              id="feedback-refresh-btn"
            >
              <RefreshCw
                className={`size-3.5 ${isLoading ? "animate-spin" : ""}`}
              />
              새로고침
            </Button>
          </div>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 요약 통계 (필터와 무관한 전체 기준) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminStatCard
          title="만족"
          value={summary.thumbsUp.toLocaleString("ko-KR")}
          description={satisfactionLabel}
          icon={ThumbsUp}
        />
        <AdminStatCard
          title="불만족"
          value={summary.thumbsDown.toLocaleString("ko-KR")}
          description="원인 파악이 필요한 건"
          icon={ThumbsDown}
        />
        <AdminStatCard
          title="코멘트"
          value={summary.withComment.toLocaleString("ko-KR")}
          description="사용자가 직접 남긴 글"
          icon={MessageSquare}
        />
      </div>

      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="feedback-search"
            placeholder="코멘트, 사용자 메일, 기업명 검색..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select
          value={rating}
          onValueChange={v => handleRatingChange(v as FeedbackRatingFilter)}
        >
          <SelectTrigger id="feedback-rating-filter" className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RATING_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="feedback-comments-only"
            checked={commentsOnly}
            onCheckedChange={checked =>
              handleCommentsOnlyChange(checked === true)
            }
          />
          <Label
            htmlFor="feedback-comments-only"
            className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer"
          >
            코멘트만 보기
          </Label>
        </div>

        {!isLoading && (
          <span className="text-sm text-muted-foreground sm:ml-auto whitespace-nowrap">
            검색 결과: {total.toLocaleString("ko-KR")}건
          </span>
        )}
      </div>

      <FeedbackTable items={items} isLoading={isLoading} />

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={e => {
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
                    onClick={e => {
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
                onClick={e => {
                  e.preventDefault();
                  if (page < totalPages) setPage(page + 1);
                }}
                className={
                  page >= totalPages ? "pointer-events-none opacity-50" : ""
                }
                aria-disabled={page >= totalPages}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
