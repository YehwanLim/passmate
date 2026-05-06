import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AnalysisSummary } from "@/types/my";
import StatusBadge from "./StatusBadge";

interface AnalysisCardProps {
  analysis: AnalysisSummary;
  /** 순번 (Q1, Q2, ...) */
  index: number;
}

export default function AnalysisCard({ analysis, index }: AnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-800 bg-zinc-900/80 rounded-xl overflow-hidden transition-colors duration-200 hover:border-zinc-700">
      {/* ── 질문 헤더 (클릭으로 원문 토글) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-3 p-5 text-left"
      >
        {/* 순번 */}
        <span className="shrink-0 text-[13px] font-semibold text-zinc-500 pt-0.5">
          Q{index + 1}.
        </span>

        {/* 질문 텍스트 */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] text-zinc-200 font-medium leading-relaxed line-clamp-2">
            {analysis.question_text}
          </p>
        </div>

        {/* 뱃지 + 화살표 */}
        <div className="shrink-0 flex items-center gap-2.5">
          <StatusBadge status={analysis.status} />
          <ChevronDown
            className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* ── 원문 자소서 (펼침 영역) ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-0">
          <div className="border-t border-zinc-800 pt-4">
            <span className="inline-block text-[11px] font-medium text-zinc-500 uppercase tracking-wider mb-3">
              작성한 내용
            </span>
            <div className="text-[13px] text-zinc-300 font-light leading-[1.85] whitespace-pre-wrap">
              {analysis.input_text || "작성된 내용이 없습니다."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
