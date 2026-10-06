import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import { pickKeySentence, type DiagnosisDisplayItem } from "@/pages/reportFirstImpression";
import type { Positioning } from "@/types/report";
import { renderCleanText, renderRichText } from "../richText";

function SummaryItem({ marker, entry }: { marker: ReactNode; entry: DiagnosisDisplayItem }) {
  const keySentence = pickKeySentence(entry.text);
  return (
    <li className="flex gap-3 border-t border-line-soft py-4">
      {marker}
      <div className="min-w-0">
        {entry.headline ? (
          <>
            <p className="text-[16px] font-bold leading-[1.45] text-ink">{entry.headline}</p>
            <p className="mt-1 text-[14px] leading-[1.6] text-ink-3">{keySentence}</p>
          </>
        ) : (
          <p className="text-[15px] leading-[1.6] text-ink-2">{keySentence}</p>
        )}
      </div>
    </li>
  );
}

/**
 * 리포트 맨 위 요약 한 장: 읽히는 모습(페르소나·한 줄 요약), 잘 읽히는 점, 고칠 점, 합격까지의 거리.
 * 항목마다 핵심 한 문장만 싣고, 자세한 근거는 아래 문장별 코멘트와 "더 자세히"가 맡는다.
 */
export function ReportSummarySection({
  heroPersonaLines,
  heroSummary,
  strengthEntries,
  gapEntries,
  positioning,
}: {
  heroPersonaLines: string[];
  heroSummary: string;
  strengthEntries: DiagnosisDisplayItem[];
  gapEntries: DiagnosisDisplayItem[];
  positioning: Positioning;
}) {
  return (
    <section id="section-summary" className="report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-11 sm:py-10">
      <p className="text-[15px] font-medium text-ink-4">{UI_LABELS.SUMMARY_READ_AS}</p>
      <h1 className="mt-2.5 text-[28px] font-bold leading-[1.32] tracking-[-0.03em] text-navy sm:text-[36px]">
        {heroPersonaLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>
      <p className="mt-3 text-[16px] leading-[1.65] text-ink-3 text-pretty">{renderCleanText(heroSummary)}</p>

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-10">
        <div>
          <h2 className="pb-1.5 text-[14px] font-bold text-ok">
            {UI_LABELS.SUMMARY_STRENGTHS} {strengthEntries.length}
          </h2>
          <ul>
            {strengthEntries.map((entry, index) => (
              <SummaryItem
                key={index}
                entry={entry}
                marker={
                  <span aria-hidden="true" className="mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ok-soft">
                    <Check className="size-3 text-ok" strokeWidth={3.2} />
                  </span>
                }
              />
            ))}
          </ul>
        </div>
        <div>
          <h2 className="pb-1.5 text-[14px] font-bold text-blank">
            {UI_LABELS.SUMMARY_GAPS} {gapEntries.length}
          </h2>
          <ol>
            {gapEntries.map((entry, index) => (
              <SummaryItem
                key={index}
                entry={entry}
                marker={
                  <span aria-hidden="true" className="mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#B97800] text-[11.5px] font-extrabold text-white">
                    {index + 1}
                  </span>
                }
              />
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-8 rounded-[18px] bg-fill-soft px-5 py-5 sm:px-6">
        <p className="text-[15px] font-bold text-ink">{UI_LABELS.STRATEGIC_POSITIONING}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] sm:gap-4">
          <div>
            <p className="text-[13px] font-bold text-ink-4">{UI_LABELS.POSITION_CURRENT}</p>
            <p className="mt-1.5 text-[15px] leading-[1.65] text-ink-3">{renderRichText(positioning.current)}</p>
          </div>
          <span aria-hidden="true" className="hidden pt-6 text-lg text-ink-5 sm:block">→</span>
          <div>
            <p className="text-[13px] font-bold text-navy">{UI_LABELS.POSITION_TARGET}</p>
            <p className="mt-1.5 text-[15px] font-bold leading-[1.65] text-ink">{renderRichText(positioning.target)}</p>
          </div>
        </div>
        {positioning.strategy?.trim() ? (
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-[13px] font-bold text-ok">{UI_LABELS.POSITION_STRATEGY}</p>
            <p className="mt-1.5 text-[15px] leading-[1.7] text-ink-2">{renderRichText(positioning.strategy)}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
