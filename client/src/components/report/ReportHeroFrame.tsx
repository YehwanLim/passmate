import type { ReactNode } from "react";

import { BrandName } from "@/components/BrandName";

/** 표지 카드 껍데기: 라운드 프레임 + 은은한 광원 + 브랜드 행. 본문은 페이지가 채운다. */
export function ReportHeroFrame({ eyebrow, children }: { eyebrow: ReactNode; children: ReactNode }) {
  return (
    <div className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B0B0E] px-5 py-5 sm:px-8 sm:py-7 md:px-10 md:py-9">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.09),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_48%)]" />
      <div className="pointer-events-none absolute inset-px rounded-[15px] border border-white/[0.035]" />
      <div className="relative flex min-w-0 flex-col gap-2 border-b border-white/[0.06] pb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <BrandName className="h-3.5 self-start" />
        <span className="min-w-0 break-words sm:text-right">{eyebrow}</span>
      </div>
      {children}
    </div>
  );
}
