import { Link, useLocation } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnalysisStatusBadge } from "./AnalysisStatusBadge";
import { ChevronRight, Bot, Zap, DollarSign } from "lucide-react";
import type { AnalysisRow } from "@/hooks/admin/useAnalysesData";

// ============================================================
// 유틸
// ============================================================

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtMs(ms: number | null): string {
  if (ms == null) return "–";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTokens(n: number): string {
  if (n === 0) return "–";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtCost(usd: number): string {
  if (usd === 0) return "–";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(4)}`;
}

// ============================================================
// 로딩 스켈레톤
// ============================================================

function RowSkeleton() {
  return (
    <TableRow>
      {[130, 180, 100, 80, 64, 56, 48, 80, 28].map((w, i) => (
        <TableCell key={i} className={i >= 2 ? "hidden md:table-cell" : ""}>
          <Skeleton className={`h-4`} style={{ width: w }} />
        </TableCell>
      ))}
    </TableRow>
  );
}

// ============================================================
// Component
// ============================================================

interface AnalysesTableProps {
  rows: AnalysisRow[];
  isLoading: boolean;
}

/**
 * AnalysesTable
 *
 * 분석 목록 테이블.
 *
 * 컬럼:
 * - 상태 (SUCCESS/FAILED/PENDING + error_code)
 * - 사용자 (이메일)
 * - 프로젝트
 * - 모델 (md 이상)
 * - 응답시간 (md 이상)
 * - 토큰 (lg 이상)
 * - 비용 (lg 이상)
 * - 일시 (md 이상)
 * - 상세 링크
 */
export function AnalysesTable({ rows, isLoading }: AnalysesTableProps) {
  const [, navigate] = useLocation();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[120px]">상태</TableHead>
              <TableHead className="w-[180px]">사용자</TableHead>
              <TableHead className="hidden sm:table-cell">프로젝트</TableHead>
              <TableHead className="hidden md:table-cell w-[130px]">모델</TableHead>
              <TableHead className="hidden md:table-cell w-[80px] text-right">응답시간</TableHead>
              <TableHead className="hidden lg:table-cell w-[70px] text-right">토큰</TableHead>
              <TableHead className="hidden lg:table-cell w-[80px] text-right">비용</TableHead>
              <TableHead className="hidden md:table-cell w-[100px] text-right">일시</TableHead>
              <TableHead className="w-[36px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => <RowSkeleton key={i} />)
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  조건에 맞는 분석이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate(`/admin/resume-analysis/${r.id}`)}
                >
                  {/* 상태 */}
                  <TableCell>
                    <AnalysisStatusBadge
                      status={r.status}
                      errorCode={r.error_code}
                    />
                  </TableCell>

                  {/* 사용자 */}
                  <TableCell>
                    <Link
                      href={`/admin/resume-analysis/${r.id}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="min-w-0">
                        {r.user_name && (
                          <p className="text-xs font-medium truncate leading-tight">
                            {r.user_name}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {r.user_email ?? "–"}
                        </p>
                      </div>
                    </Link>
                  </TableCell>

                  {/* 프로젝트 */}
                  <TableCell className="hidden sm:table-cell p-0">
                    <Link
                      href={`/admin/resume-analysis/${r.id}`}
                      className="block px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="min-w-0 max-w-[180px]">
                        <p className="text-sm font-medium truncate hover:underline">
                          {r.project_title ?? "–"}
                        </p>
                        {(r.project_company || r.project_job_keyword) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[r.project_company, r.project_job_keyword]
                              .filter(Boolean)
                              .join(" / ")}
                          </p>
                        )}
                        {r.total_chars != null && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {r.total_chars.toLocaleString("ko-KR")}자
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>

                  {/* 모델 */}
                  <TableCell className="hidden md:table-cell">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-default">
                          <Bot className="size-3 flex-shrink-0" />
                          <span className="truncate max-w-[100px]">
                            {r.model_name ?? "–"}
                          </span>
                        </span>
                      </TooltipTrigger>
                      {r.model_provider && (
                        <TooltipContent side="top" className="text-xs">
                          {r.model_provider} / {r.model_name}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TableCell>

                  {/* 응답시간 */}
                  <TableCell className="hidden md:table-cell text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`text-xs tabular-nums cursor-default ${
                            r.response_time_ms != null && r.response_time_ms > 5000
                              ? "text-amber-600 font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Zap className="inline size-3 mr-0.5 opacity-60" />
                          {fmtMs(r.response_time_ms)}
                        </span>
                      </TooltipTrigger>
                      {r.response_time_ms != null && (
                        <TooltipContent side="top" className="text-xs">
                          {r.response_time_ms.toLocaleString("ko-KR")}ms
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TableCell>

                  {/* 토큰 */}
                  <TableCell className="hidden lg:table-cell text-right text-xs text-muted-foreground tabular-nums">
                    {fmtTokens(r.total_tokens)}
                  </TableCell>

                  {/* 비용 */}
                  <TableCell className="hidden lg:table-cell text-right">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      <DollarSign className="inline size-3 opacity-50" />
                      {fmtCost(r.total_cost).replace("$", "")}
                    </span>
                  </TableCell>

                  {/* 일시 */}
                  <TableCell className="hidden md:table-cell text-right text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(r.created_at)}
                  </TableCell>

                  {/* 상세 */}
                  <TableCell>
                    <Link
                      href={`/admin/resume-analysis/${r.id}`}
                      className="inline-flex rounded-md p-1 hover:bg-muted"
                      onClick={(event) => event.stopPropagation()}
                      aria-label="분석 상세 보기"
                    >
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
