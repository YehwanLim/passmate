import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { DiagnosisDisplayItem, HighlightedTextSegment } from "@/pages/reportFirstImpression";
import type { Positioning } from "@/types/report";
import { renderRichText, renderTextSegments } from "../richText";

function DiagnosisColumn({
  title,
  tone,
  entries,
  highlights,
  marker,
}: {
  title: string;
  tone: "ok" | "fix";
  entries: DiagnosisDisplayItem[];
  highlights: HighlightedTextSegment[][];
  marker: (index: number) => ReactNode;
}) {
  return (
    <div>
      <p className={`border-b border-line bg-fill-soft px-5 py-3 text-[14px] font-bold ${tone === "ok" ? "text-ok" : "text-blank"}`}>
        {title} {entries.length}
      </p>
      <ul>
        {entries.map((entry, i) => (
          <li key={i} className="flex gap-3 border-t border-line-soft px-5 py-5 first:border-t-0">
            {marker(i)}
            <div className="min-w-0">
              {entry.headline ? <p className="mb-1.5 text-[16px] font-bold leading-[1.45] text-ink">{entry.headline}</p> : null}
              <p className="text-[15px] leading-[1.75] text-ink-3">{renderTextSegments(highlights[i] ?? [])}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 02 핵심 진단: 잘 읽히는 점·고칠 점을 표 한 칸의 두 열로, 그 아래 합격까지의 거리(지금 → 기대, 아쉬운 부분, 좁히는 법).
 * 항목마다 모델이 고른 핵심 문장 하나만 굵게 둔다(limitSectionHighlights).
 */
export function CoreDiagnosisSection({
  strengthEntries,
  gapEntries,
  strengthHighlights,
  gapHighlights,
  positioning,
}: {
  strengthEntries: DiagnosisDisplayItem[];
  gapEntries: DiagnosisDisplayItem[];
  strengthHighlights: HighlightedTextSegment[][];
  gapHighlights: HighlightedTextSegment[][];
  positioning: Positioning;
}) {
  return (
    <div className="space-y-4">
      <div className="grid overflow-hidden rounded-2xl border border-line md:grid-cols-2">
        <DiagnosisColumn
          title={UI_LABELS.SUMMARY_STRENGTHS}
          tone="ok"
          entries={strengthEntries}
          highlights={strengthHighlights}
          marker={() => (
            <span aria-hidden="true" className="mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ok-soft">
              <Check className="size-3 text-ok" strokeWidth={3.2} />
            </span>
          )}
        />
        <div className="border-t border-line md:border-l md:border-t-0">
          <DiagnosisColumn
            title={UI_LABELS.SUMMARY_GAPS}
            tone="fix"
            entries={gapEntries}
            highlights={gapHighlights}
            marker={(i) => (
              <span aria-hidden="true" className="mt-0.5 inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#B97800] text-[11.5px] font-extrabold text-white">
                {i + 1}
              </span>
            )}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <p className="border-b border-line bg-fill-soft px-5 py-3 text-[14px] font-bold text-ink-2">{UI_LABELS.STRATEGIC_POSITIONING}</p>
        <div className="grid sm:grid-cols-[minmax(0,1fr)_40px_minmax(0,1fr)]">
          <div className="px-5 py-5">
            <p className="text-[13px] font-bold text-ink-4">{UI_LABELS.POSITION_CURRENT}</p>
            <p className="mt-1.5 text-[15px] leading-[1.7] text-ink-3">{renderRichText(positioning.current)}</p>
          </div>
          <span aria-hidden="true" className="flex items-center justify-center text-ink-5">
            <ArrowRight className="size-[18px] rotate-90 sm:rotate-0" />
          </span>
          <div className="px-5 py-5">
            <p className="text-[13px] font-bold text-navy">{UI_LABELS.POSITION_TARGET}</p>
            <p className="mt-1.5 text-[15px] font-semibold leading-[1.7] text-ink">{renderRichText(positioning.target)}</p>
          </div>
        </div>
        {[
          { label: UI_LABELS.POSITION_GAP, text: positioning.gap, tone: "text-blank" },
          { label: UI_LABELS.POSITION_STRATEGY, text: positioning.strategy, tone: "text-ok" },
        ]
          .filter((row) => row.text?.trim())
          .map((row) => (
            <div key={row.label} className="flex flex-col gap-1.5 border-t border-line-soft px-5 py-4 sm:flex-row sm:gap-6">
              <p className={`shrink-0 text-[13px] font-bold sm:w-[120px] sm:pt-0.5 ${row.tone}`}>{row.label}</p>
              <p className="text-[15px] leading-[1.7] text-ink-2">{renderRichText(row.text)}</p>
            </div>
          ))}
      </div>
    </div>
  );
}
