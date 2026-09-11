import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import AuthButton from "@/components/AuthButton";
import { cn } from "@/lib/utils";
import type { ReportNavSection } from "@/pages/reportNavigation";
import { SectionChipBar } from "./SectionChipBar";

/** 리포트 상단 sticky 바: 뒤로 가기 + 페이지별 액션 + 로그인 버튼 + 섹션 칩. */
export const REPORT_NAV_ACTION_CLASS =
  "text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200";

export function ReportTopNav({
  sections,
  activeSection,
  backLabel,
  actions,
  className,
}: {
  sections: ReportNavSection[];
  activeSection: string;
  backLabel: string;
  actions: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sticky top-0 z-50 w-full bg-[#09090B]/95 backdrop-blur-md border-b border-white/[0.05]", className)}>
      <div className="max-w-4xl mx-auto px-6 md:px-8 pt-4 pb-3 sm:pt-6 sm:pb-4 flex items-center justify-between">
        <button onClick={() => window.history.back()} className="inline-flex items-center gap-2.5 text-sm text-zinc-500 hover:text-white transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>{backLabel}</span>
        </button>
        <div className="flex items-center gap-2">
          {actions}
          <AuthButton />
        </div>
      </div>
      <SectionChipBar sections={sections} activeSection={activeSection} />
    </div>
  );
}
