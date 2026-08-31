import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { FeedbackDetailDialog } from "./FeedbackDetailDialog";
import { Eye, MessageSquareOff } from "lucide-react";
import type { FeedbackItem } from "@/hooks/admin/useFeedbackData";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RowSkeleton() {
  return (
    <TableRow>
      {[70, 160, 140, 280, 90, 40].map((w, i) => (
        <TableCell
          key={i}
          className={i === 2 || i === 4 ? "hidden md:table-cell" : ""}
        >
          <Skeleton className="h-4" style={{ width: w }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

interface FeedbackTableProps {
  items: FeedbackItem[];
  isLoading: boolean;
}

export function FeedbackTable({ items, isLoading }: FeedbackTableProps) {
  const [selected, setSelected] = useState<FeedbackItem | null>(null);

  return (
    <>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[90px]">평가</TableHead>
              <TableHead className="w-[180px]">사용자</TableHead>
              <TableHead className="hidden md:table-cell w-[160px]">
                지원 대상
              </TableHead>
              <TableHead>코멘트</TableHead>
              <TableHead className="hidden md:table-cell w-[120px] text-right">
                접수 시각
              </TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  조건에 맞는 피드백이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              items.map(item => {
                const isPositive = item.rating === "THUMBS_UP";
                const target = [item.company, item.jobKeyword]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <TableRow
                    key={item.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelected(item)}
                  >
                    {/* 평가 */}
                    <TableCell>
                      <Badge
                        variant={isPositive ? "secondary" : "destructive"}
                        className="text-[10px] font-semibold px-1.5 py-0.5"
                      >
                        {isPositive ? "👍 만족" : "👎 불만족"}
                      </Badge>
                    </TableCell>

                    {/* 사용자 */}
                    <TableCell>
                      <div className="min-w-0">
                        {item.userName && (
                          <p className="text-xs font-medium truncate leading-tight">
                            {item.userName}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate leading-tight">
                          {item.userEmail ?? "–"}
                        </p>
                      </div>
                    </TableCell>

                    {/* 지원 대상 */}
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate">
                      {target || "–"}
                    </TableCell>

                    {/* 코멘트 프리뷰 */}
                    <TableCell>
                      {item.comment ? (
                        <p className="text-sm truncate max-w-[280px] sm:max-w-[420px]">
                          {item.comment}
                        </p>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageSquareOff className="size-3.5 flex-shrink-0" />
                          코멘트 없음
                        </span>
                      )}
                    </TableCell>

                    {/* 접수 시각 */}
                    <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </TableCell>

                    {/* 상세보기 */}
                    <TableCell>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelected(item);
                        }}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="피드백 상세 보기"
                      >
                        <Eye className="size-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <FeedbackDetailDialog
        feedback={selected}
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
