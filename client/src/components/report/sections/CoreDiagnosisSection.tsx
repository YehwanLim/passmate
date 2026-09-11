import { UI_LABELS } from "@/constants/labels";
import type { DiagnosisDisplayItem, HighlightedTextSegment } from "@/pages/reportFirstImpression";
import type { Positioning } from "@/types/report";
import { SectionNumber } from "../SectionNumber";
import { renderRichText, renderTextSegments } from "../richText";

/** ACT 2 — 핵심 진단: 강점, 보완점, 전략적 포지셔닝. */
export function CoreDiagnosisSection({
  targetCompany,
  strengthEntries,
  gapEntries,
  strengthHighlights,
  gapHighlights,
  positioning,
}: {
  targetCompany: string;
  strengthEntries: DiagnosisDisplayItem[];
  gapEntries: DiagnosisDisplayItem[];
  strengthHighlights: HighlightedTextSegment[][];
  gapHighlights: HighlightedTextSegment[][];
  positioning: Positioning;
}) {
  return (
    <section id="section-core-diagnosis" className="py-24 section-divider">
      <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-14 tracking-tight"><SectionNumber value="03" />{UI_LABELS.STRENGTHS_AND_GAPS(targetCompany)}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-14 mb-16">
        <div>
          <p className="text-[15px] font-bold text-emerald-300/90 mb-6">{UI_LABELS.STRENGTHS}</p>
          <div>
            {strengthEntries.map((entry, i) => (
              <div key={i} className={i > 0 ? "mt-7 border-t border-white/[0.05] pt-7" : ""}>
                {entry.headline ? (
                  <>
                    <p className="mb-2.5 flex items-center gap-2.5 text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50">
                      <span aria-hidden="true" className="mx-[3px] inline-block size-[7px] shrink-0 rounded-full bg-emerald-400/85 shadow-[0_0_8px_rgba(52,211,153,0.35)]" />
                      {entry.headline}
                    </p>
                    <p className="pl-[23px] text-[15px] leading-[1.85] text-zinc-400">{renderTextSegments(strengthHighlights[i], "strength")}</p>
                  </>
                ) : (
                  <p className="text-[16px] leading-[1.8] text-zinc-100">{renderTextSegments(strengthHighlights[i], "strength")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[15px] font-bold text-amber-300/80 mb-6">{UI_LABELS.GAPS}</p>
          <div>
            {gapEntries.map((entry, i) => (
              <div key={i} className={i > 0 ? "mt-7 border-t border-white/[0.05] pt-7" : ""}>
                {entry.headline ? (
                  <>
                    <p className="mb-2.5 flex items-baseline gap-2.5 text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-50">
                      <span aria-hidden="true" className="w-[13px] shrink-0 text-[13px] text-amber-300/70">△</span>
                      {entry.headline}
                    </p>
                    <p className="pl-[23px] text-[15px] leading-[1.85] text-zinc-400">{renderTextSegments(gapHighlights[i], "gap")}</p>
                  </>
                ) : (
                  <p className="text-[16px] leading-[1.8] text-zinc-300">{renderTextSegments(gapHighlights[i], "gap")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Positioning */}
      <div className="bg-white/[0.03] border border-white/[0.05] p-6 sm:p-9 rounded-xl">
        <p className="text-[17px] font-semibold tracking-[-0.01em] text-zinc-50 mb-8">{UI_LABELS.STRATEGIC_POSITIONING}</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_40px_1fr] gap-5 items-stretch mb-9">
          <div>
            <span className="inline-block rounded-md border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-zinc-400 mb-3.5">{UI_LABELS.POSITION_CURRENT}</span>
            <p className="text-[15px] text-zinc-400 leading-[1.8]">{renderRichText(positioning.current)}</p>
          </div>
          <div aria-hidden="true" className="flex items-center justify-center text-xl text-zinc-700 rotate-90 sm:rotate-0 -my-1 sm:my-0">→</div>
          <div>
            <span className="inline-block rounded-md border border-sky-300/20 bg-sky-300/[0.08] px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-sky-300 mb-3.5">{UI_LABELS.POSITION_TARGET}</span>
            <p className="text-[15px] text-zinc-100 leading-[1.8]">{renderRichText(positioning.target)}</p>
          </div>
        </div>
        <div className="border-t border-white/[0.05] pt-7 mb-7">
          <p className="text-sm font-semibold text-amber-300/80 mb-2.5">{UI_LABELS.POSITION_GAP}</p>
          <p className="text-[15px] text-zinc-200 leading-[1.8] max-w-2xl">{renderRichText(positioning.gap)}</p>
        </div>
        <div className="border-t border-white/[0.05] pt-7">
          <p className="text-sm font-semibold text-emerald-300/85 mb-2.5">{UI_LABELS.POSITION_STRATEGY}</p>
          <p className="text-[15px] text-zinc-200 leading-[1.8] max-w-2xl">{renderRichText(positioning.strategy)}</p>
        </div>
      </div>
    </section>
  );
}
