import { useEffect, useMemo, useState } from "react";
import type { AnalysisSummary, AnalysisDetail } from "@/types/my";
import { parseAnalysisSections, type AnalysisSection } from "@/lib/analysisSections";
import { getAuthorizationHeader } from "@/lib/apiAuth";
import { formatDate } from "@/lib/formatDate";
import StatusBadge from "./StatusBadge";

interface AnalysisCardProps {
  analysis: AnalysisSummary;
}

export default function AnalysisCard({ analysis }: AnalysisCardProps) {
  const [sections, setSections] = useState<AnalysisSection[] | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // 목록 응답에는 질문만 있으므로, 진입 즉시 원문 전체를 불러온다.
  useEffect(() => {
    let cancelled = false;

    const loadDetail = async () => {
      try {
        setDetailError(null);
        const response = await fetch(`/api/analysis/${encodeURIComponent(analysis.id)}`, {
          headers: await getAuthorizationHeader(),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const detail: AnalysisDetail = await response.json();
        if (!cancelled) {
          setSections(parseAnalysisSections(detail.question_text, detail.input_text));
        }
      } catch {
        if (!cancelled) {
          setDetailError("작성한 내용을 불러오지 못했습니다. 새로고침해 주세요.");
        }
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [analysis.id]);

  // 로딩 중에는 목록 응답의 질문만으로 뼈대를 먼저 그린다.
  const previewSections = useMemo(
    () => parseAnalysisSections(analysis.question_text),
    [analysis.question_text],
  );
  const visibleSections = sections ?? previewSections;

  return (
    <div>
      {/* ── 분석 회차 헤더 ── */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[13px] text-ink-4">
          {formatDate(analysis.created_at, "ymd-dot")} 작성 · 문항 {Math.max(visibleSections.length, 1)}개
        </span>
        <StatusBadge status={analysis.status} />
      </div>

      {detailError && (
        <p role="alert" className="mb-3 px-1 text-[13px] text-danger">
          {detailError}
        </p>
      )}

      {/* ── 문항별 카드 (전부 펼쳐서, 뚜렷하게 구분) ── */}
      <div className="grid gap-4">
        {visibleSections.map((section, idx) => (
          <div
            key={idx}
            className="bg-surface rounded-[20px] overflow-hidden"
          >
            {/* 질문 헤더 — 전문 표시, 자르지 않음 */}
            <div className="flex items-start gap-3 px-5 py-4 border-b border-line-soft">
              <span className="shrink-0 pt-0.5 text-[13px] font-bold text-brand-ink">
                Q{idx + 1}
              </span>
              <p className="text-[15px] text-ink font-semibold leading-relaxed">
                {section.question || "문항"}
              </p>
            </div>

            {/* 작성한 원문 */}
            <div className="px-5 py-4">
              {sections === null && !detailError ? (
                <div className="space-y-2">
                  <div className="h-3.5 w-full bg-fill rounded animate-pulse" />
                  <div className="h-3.5 w-11/12 bg-fill rounded animate-pulse" />
                  <div className="h-3.5 w-4/5 bg-fill rounded animate-pulse" />
                </div>
              ) : (
                <div className="text-[14px] text-ink-2 leading-[1.85] whitespace-pre-wrap">
                  {section.answer || "작성된 내용이 없습니다."}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
