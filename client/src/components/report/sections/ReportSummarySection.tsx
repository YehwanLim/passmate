import type { ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import { pickKeySentence, type DiagnosisDisplayItem } from "@/pages/reportFirstImpression";
import type { Positioning } from "@/types/report";
import { renderCleanText, renderRichText } from "../richText";

/** 회색 판 안의 흰 칸 하나 = 항목 하나. 제목 한 줄 + 핵심 문장 한 줄. */
function SummaryItem({ marker, entry }: { marker: ReactNode; entry: DiagnosisDisplayItem }) {
  const keySentence = pickKeySentence(entry.text);
  return (
    <li className="flex gap-3 rounded-2xl bg-surface px-4 py-4 shadow-[0_1px_2px_rgba(25,31,40,0.05)]">
      {marker}
      <div className="min-w-0">
        {entry.headline ? (
          <>
            <p className="text-[16px] font-bold leading-[1.45] text-ink">{entry.headline}</p>
            <p className="mt-1 text-[14px] leading-[1.6] text-ink-3">{keySentence}</p>
          </>
        ) : (
          <p className="text-[15px] font-semibold leading-[1.6] text-ink-2">{keySentence}</p>
        )}
      </div>
    </li>
  );
}

function SummaryGroup({ title, tone, children }: { title: string; tone: "ok" | "fix"; children: ReactNode }) {
  return (
    <div className="rounded-[20px] bg-fill px-4 pb-4 pt-5 sm:px-5">
      <h2 className={`px-1 text-[15px] font-bold ${tone === "ok" ? "text-ok" : "text-blank"}`}>{title}</h2>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  );
}

/**
 * 리포트 맨 위 요약 한 장: 읽히는 모습(페르소나·한 줄 요약), 잘 읽히는 점, 고칠 점, 합격까지의 거리.
 * 잘 읽히는 점·고칠 점은 회색 판 하나에 흰 칸으로 묶어 덩어리로 보이게 한다. 항목마다 핵심 한 문장만 싣는다.
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
    <section id="section-summary" className="report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-10 sm:py-10">
      <p className="text-[15px] font-semibold text-ink-4">{UI_LABELS.SUMMARY_READ_AS}</p>
      <h1 className="mt-2.5 text-[28px] font-bold leading-[1.32] tracking-[-0.03em] text-navy sm:text-[36px]">
        {heroPersonaLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>
      <p className="mt-3 max-w-3xl text-[16px] leading-[1.65] text-ink-3 text-pretty">{renderCleanText(heroSummary)}</p>

      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <SummaryGroup title={`${UI_LABELS.SUMMARY_STRENGTHS} ${strengthEntries.length}`} tone="ok">
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
        </SummaryGroup>
        <SummaryGroup title={`${UI_LABELS.SUMMARY_GAPS} ${gapEntries.length}`} tone="fix">
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
        </SummaryGroup>
      </div>

      <div className="mt-3 rounded-[20px] border border-line px-5 pb-5 pt-5 sm:px-6">
        <h2 className="text-[15px] font-bold text-ink">{UI_LABELS.STRATEGIC_POSITIONING}</h2>
        <div className="mt-3 grid items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)]">
          <div className="rounded-2xl bg-fill-soft px-4 py-4">
            <p className="text-[13px] font-bold text-ink-4">{UI_LABELS.POSITION_CURRENT}</p>
            <p className="mt-1.5 text-[15px] leading-[1.65] text-ink-3">{renderRichText(positioning.current)}</p>
          </div>
          <span aria-hidden="true" className="flex items-center justify-center text-ink-5">
            <ArrowRight className="size-[18px] rotate-90 sm:rotate-0" />
          </span>
          <div className="rounded-2xl border-[1.5px] border-ink bg-surface px-4 py-4">
            <p className="text-[13px] font-bold text-navy">{UI_LABELS.POSITION_TARGET}</p>
            <p className="mt-1.5 text-[15px] font-bold leading-[1.65] text-ink">{renderRichText(positioning.target)}</p>
          </div>
        </div>
        {positioning.strategy?.trim() ? (
          <div className="mt-4 flex flex-col gap-1.5 border-t border-line-soft pt-4 sm:flex-row sm:gap-5">
            <p className="shrink-0 text-[13px] font-bold text-ok sm:w-[88px] sm:pt-0.5">{UI_LABELS.POSITION_STRATEGY}</p>
            <p className="text-[15px] leading-[1.7] text-ink-2">{renderRichText(positioning.strategy)}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
