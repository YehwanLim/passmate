import { useEffect, useRef } from "react";

import { scrollChildIntoHorizontalView } from "@/pages/reportLineAnalysis";
import type { ReportNavSection } from "@/pages/reportNavigation";

/** xl 미만에서 좌측 목차를 대신하는 가로 스크롤 섹션 칩. sticky 헤더 안에 붙어 함께 고정된다. */
export function SectionChipBar({
  sections,
  activeSection,
}: {
  sections: ReportNavSection[];
  activeSection: string;
}) {
  const barRef = useRef<HTMLElement>(null);

  // 스크롤 스파이가 바뀔 때 활성 칩이 화면 가운데로 오게 가로만 스크롤한다.
  useEffect(() => {
    const bar = barRef.current;
    const chip = bar?.querySelector<HTMLElement>(`[data-section="${activeSection}"]`) ?? null;
    scrollChildIntoHorizontalView(bar, chip);
  }, [activeSection]);

  return (
    <nav
      ref={barRef}
      className="xl:hidden mx-auto flex max-w-4xl gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap px-6 pb-3 md:px-8"
      aria-label="리포트 목차"
    >
      {sections.map((section) => {
        const isActive = activeSection === section.id;
        return (
          <a
            key={section.id}
            href={`#${section.id}`}
            data-section={section.id}
            aria-current={isActive ? "location" : undefined}
            className={`inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors ${
              isActive
                ? "border-emerald-300/[0.22] bg-emerald-300/[0.08] text-emerald-100/80"
                : "border-white/[0.07] bg-white/[0.03] text-zinc-500"
            }`}
            onClick={(event) => {
              event.preventDefault();
              document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className={`text-[11px] font-semibold tabular-nums ${isActive ? "text-emerald-100/80" : "text-zinc-600"}`}>{section.indexLabel}</span>
            <span>{section.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
