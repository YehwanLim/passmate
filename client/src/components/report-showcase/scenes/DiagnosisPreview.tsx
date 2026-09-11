import { AlertTriangle, ArrowRight, Check } from "lucide-react";

import { diagnosisPriorities, gaps, strengths } from "../reportShowcaseSampleData";

export function DiagnosisPreview() {
  return (
    <section className="flex flex-col py-3 lg:h-full lg:justify-between lg:overflow-hidden">
      <div>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
          02. 핵심 진단
        </h3>
        <p className="mb-4 break-keep text-[21px] font-semibold leading-[1.35] tracking-tight text-white md:text-[25px]">
          강점은 이미 뚜렷합니다.
          <br />
          <span className="text-amber-200">
            현대자동차와 연결되는 한 장면
          </span>
          이 아직 없습니다.
        </p>
      </div>

      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-300/[0.14] bg-emerald-300/[0.035] p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-emerald-300">
            <Check className="h-3.5 w-3.5" />
            강점
          </p>
          <div className="space-y-2">
            {strengths.map(item => (
              <p
                key={item}
                className="grid grid-cols-[10px_1fr] gap-1.5 text-[12px] leading-[1.5] text-zinc-100"
              >
                <span aria-hidden="true" className="text-emerald-300/60">
                  ·
                </span>
                {item}
              </p>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-amber-200/[0.16] bg-amber-200/[0.04] p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-[13px] font-bold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            보완점
          </p>
          <div className="space-y-2">
            {gaps.map(item => (
              <p
                key={item}
                className="grid grid-cols-[10px_1fr] gap-1.5 text-[12px] leading-[1.5] text-zinc-100"
              >
                <span aria-hidden="true" className="text-amber-200/60">
                  ·
                </span>
                {item}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
        <p className="mb-2.5 text-sm font-semibold text-white">
          우선 보완 순서
        </p>
        <ol className="grid gap-2 md:grid-cols-3">
          {diagnosisPriorities.map((item, index) => (
            <li
              key={item}
              className="rounded-lg border border-white/[0.06] bg-black/20 p-2.5"
            >
              <span className="text-[18px] font-extrabold leading-none text-[#A7A8FF] opacity-70">
                {index + 1}
              </span>
              <p className="mt-1.5 text-[11.5px] leading-[1.5] text-zinc-300">
                {item}
              </p>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_20px_1fr]">
          <div>
            <span className="inline-block rounded-md border border-white/[0.05] bg-zinc-800/80 px-2 py-1 text-[10px] font-semibold text-zinc-400">
              지금 읽히는 모습
            </span>
            <p className="mt-1.5 text-[12px] leading-[1.5] text-zinc-400">
              데이터 툴 활용과 실행력은 검증되었으나, 모빌리티 비즈니스 이해가
              약한 주니어
            </p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-zinc-600 sm:block" />
          <div>
            <span className="inline-block rounded-md border border-emerald-300/[0.2] bg-emerald-300/[0.06] px-2 py-1 text-[10px] font-semibold text-emerald-200">
              보완하면 읽힐 모습
            </span>
            <p className="mt-1.5 text-[12.5px] font-bold leading-[1.5] text-white">
              데이터 인사이트로 고객 경험을 높이는 모빌리티 PM
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
