import { useState, useCallback } from "react";
import { AdminErrorAlert } from "@/components/admin/shared/AdminErrorAlert";
import { AdminPageHeader } from "@/components/admin/shared/AdminPageHeader";
import { AdminPagination } from "@/components/admin/shared/AdminPagination";
import { AnalysesFilters } from "@/components/admin/resume-analysis/AnalysesFilters";
import { AnalysesTable } from "@/components/admin/resume-analysis/AnalysesTable";
import { useAnalysesData, useAvailableModels, type AnalysisStatus, type AnalysisSortField, type SortDir } from "@/hooks/admin/useAnalysesData";

const PAGE_SIZE = 15;

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

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Resume Analysis"
        description="제출된 이력서 분석 내역을 상세 조회하고 모델 가동 비용을 추적합니다."
      />

      <AdminErrorAlert message={error} />

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

      <AdminPagination page={page} totalPages={totalPages} onPageChange={setPage} />

      {!isLoading && total > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}번째 / 총{" "}
          {total.toLocaleString("ko-KR")}건
        </p>
      )}
    </div>
  );
}
