import { ArrowRight, Download, PlusCircle } from "lucide-react";
import { useLocation } from "wouter";

import { UI_LABELS } from "@/constants/labels";

/** 리포트 꼬리: 기업 분석 업셀, 다음 행동(새 분석·PDF 저장), 푸터. 인쇄에는 업셀·다음 행동을 넣지 않는다. */
export function ReportClosing({
  targetCompany,
  targetJobRole,
  activeAnalysisId,
  onPrint,
}: {
  targetCompany: string;
  targetJobRole: string;
  activeAnalysisId: string;
  onPrint: () => void;
}) {
  const [, navigate] = useLocation();

  return (
    <>
      {/* 기업 분석 업셀 — 같은 회사·직무로 다음 상품. 인쇄에는 넣지 않는다. */}
      <section className="print:hidden mt-10 rounded-xl border border-sky-500/[0.18] bg-sky-500/[0.04] px-6 py-8 md:px-10 md:py-9">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-300">이 회사를 더 깊게 보기</p>
        <h3 className="mt-3 text-xl font-medium text-white text-balance">{targetCompany ? `${targetCompany} 기업 분석 리포트` : "지원 기업 분석 리포트"}</h3>
        <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 text-pretty">무엇을 팔아 돈을 버는지, 요즘 힘을 싣는 사업이 무엇인지, 이 직무가 어떤 문제를 푸는지를 출처와 함께 정리해 자소서에 쓸 사업 소재까지 이어 드려요.</p>
        <button
          onClick={() => navigate(`/company-analysis?company=${encodeURIComponent(targetCompany)}&jobKeyword=${encodeURIComponent(targetJobRole)}&resumeAnalysisId=${encodeURIComponent(activeAnalysisId ?? "")}`)}
          className="mt-6 w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
        >
          <span>기업 분석 리포트 받기</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* NEXT STEP */}
      <section className="print:hidden py-16 mt-10 bg-white/[0.02] rounded-xl border border-white/[0.04] px-6 md:px-10 text-center">
        <h3 className="text-xl font-medium text-white mb-8">{UI_LABELS.WHATS_NEXT}</h3>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button onClick={() => navigate("/analyze")} className="w-full sm:w-auto px-6 py-3.5 bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2">
            <PlusCircle className="w-4 h-4" /><span>{UI_LABELS.ANALYZE_NEW}</span>
          </button>
          <button onClick={onPrint} className="w-full sm:w-auto px-6 py-3.5 bg-transparent border border-white/10 text-zinc-300 font-medium rounded-lg hover:bg-white/[0.02] transition-colors flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /><span>{UI_LABELS.SAVE_REPORT}</span>
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pt-20 pb-8 mt-10">
        <p className="text-xs text-zinc-600 leading-relaxed mb-6 text-center">{UI_LABELS.FOOTER_DISCLAIMER}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-zinc-600">
          <p>Pre:View 2026. All rights reserved.</p>
          <span className="hidden sm:inline">-</span>
          <p>Report ID: RPT-2026-0430-{Math.random().toString(36).slice(2, 6).toUpperCase()}</p>
        </div>
      </footer>
    </>
  );
}
