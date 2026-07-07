import { useState, useCallback } from "react";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AnalysesFilters } from "@/components/admin/resume-analysis/AnalysesFilters";
import { AnalysesTable } from "@/components/admin/resume-analysis/AnalysesTable";
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
import { useAnalysesData, useAvailableModels, type AnalysisStatus, type AnalysisSortField, type SortDir } from "@/hooks/admin/useAnalysesData";
import { AlertCircle } from "lucide-react";

const PAGE_SIZE = 15;

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

export default function ResumeAnalysisPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AnalysisStatus>("ALL");
  const [model, setModel] = useState("ALL");
  const [sortField, setSortField] = useState<AnalysisSortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const handleSearchChange = useCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((v: AnalysisStatus) => {
    setStatus(v);
    setPage(1);
  }, []);

  const handleModelChange = useCallback((v: string) => {
    setModel(v);
    setPage(1);
  }, []);

  const { rows, total, totalPages, isLoading, error } = useAnalysesData({
    search,
    status,
    model,
    sortField,
    sortDir,
    page,
    pageSize: PAGE_SIZE,
  });

  const availableModels = useAvailableModels();
  const pageNumbers = getPageNumbers(page, totalPages);

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Resume Analysis"
        description="제출된 이력서 분석 내역을 상세 조회하고 모델 가동 비용을 추적합니다."
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AnalysesFilters
        search={search}
        onSearchChange={handleSearchChange}
        status={status}
        onStatusChange={handleStatusChange}
        model={model}
        onModelChange={handleModelChange}
        models={availableModels}
        sortField={sortField}
        onSortFieldChange={(v) => { setSortField(v); setPage(1); }}
        sortDir={sortDir}
        onSortDirChange={(v) => { setSortDir(v); setPage(1); }}
        total={total}
        isLoading={isLoading}
      />

      <AnalysesTable rows={rows} isLoading={isLoading} />

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

      {!isLoading && total > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}번째 / 총{" "}
          {total.toLocaleString("ko-KR")}건
        </p>
      )}
    </div>
  );
}
