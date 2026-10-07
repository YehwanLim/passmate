import type { ReactNode } from "react";

import { BrandName } from "@/components/BrandName";

/** 표지 카드 껍데기: 흰 라운드 카드 + 브랜드 행. 본문은 페이지가 채운다. */
export function ReportHeroFrame({ eyebrow, children }: { eyebrow: ReactNode; children: ReactNode }) {
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-[28px] bg-surface px-5 py-5 sm:px-8 sm:py-7 md:px-10 md:py-9">
      <div className="relative flex min-w-0 flex-col gap-2 border-b border-line-soft pb-4 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-4 sm:flex-row sm:items-center sm:justify-between">
        <BrandName variant="default" className="h-3.5 self-start" />
        <span className="min-w-0 break-words sm:text-right">{eyebrow}</span>
      </div>
      {children}
    </div>
  );
}
