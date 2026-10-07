import { AlertTriangle, Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { HiringMemoryItem } from "@/pages/reportFirstImpression";
import { renderCleanText } from "../richText";

/**
 * 01 첫인상(리포트 표지): 읽히는 모습(페르소나)·한 줄 요약·키워드, 그 아래 표 한 칸에
 * "채용담당자가 기억할 모습"과 "지원자 프로필"을 나란히 둔다.
 */
export function FirstImpressionSection({
  index,
  displayName,
  heroPersona,
  heroPersonaLines,
  heroSummary,
  keywords,
  hiringMemoryItems,
  profileNote,
}: {
  index: string;
  displayName: string;
  heroPersona: string;
  heroPersonaLines: string[];
  heroSummary: string;
  keywords: string[];
  hiringMemoryItems: HiringMemoryItem[];
  profileNote: string | undefined;
}) {
  return (
    <section id="section-first-impression" className="report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-10 sm:py-10">
      <p className="text-[14px] font-bold text-ink-4">
        <span className="mr-2 tabular-nums text-ink-5">{index}</span>
        {UI_LABELS.REPORT_NAV_FIRST_IMPRESSION}
      </p>
      <p className="mt-4 text-[16px] font-medium text-ink-3">{displayName}님은 채용 담당자에게 이렇게 읽혀요</p>
      <h1 className="mt-2 text-[30px] font-bold leading-[1.3] tracking-[-0.03em] text-navy sm:text-[38px]">
        {heroPersonaLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h1>
      <p className="mt-3 max-w-3xl text-[16px] leading-[1.7] text-ink-3 text-pretty">{renderCleanText(heroSummary)}</p>
      {keywords.length > 0 ? (
        <p className="mt-3 text-[14px] font-medium text-ink-4">{keywords.map((keyword) => `#${keyword.replace(/^#/, "")}`).join("  ")}</p>
      ) : null}

      <div className="mt-8 grid overflow-hidden rounded-2xl border border-line md:grid-cols-2">
        <div>
          <p className="border-b border-line bg-fill-soft px-5 py-3 text-[14px] font-bold text-ink-2">{UI_LABELS.HIRING_MEMORY}</p>
          <ul className="space-y-3 px-5 py-5">
            {hiringMemoryItems.map((item) => (
              <li key={`${item.mark}-${item.text}`} className="flex gap-2.5 text-[15px] leading-[1.6] text-ink-2">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 inline-flex size-[20px] shrink-0 items-center justify-center rounded-full ${item.mark === "✓" ? "bg-ok-soft text-ok" : "bg-blank-soft text-blank"}`}
                >
                  {item.mark === "✓" ? <Check className="size-3" strokeWidth={3.2} /> : <AlertTriangle className="size-3" strokeWidth={2.6} />}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-line md:border-l md:border-t-0">
          <p className="border-b border-line bg-fill-soft px-5 py-3 text-[14px] font-bold text-ink-2">{UI_LABELS.APPLICANT_PROFILE}</p>
          <p className="px-5 py-5 text-[15px] leading-[1.8] text-ink-3">
            {profileNote?.trim()
              ? renderCleanText(profileNote)
              : `${heroPersona}라는 인상이 먼저 남습니다. 경험의 흐름은 문제를 발견하고 근거를 모아 실행으로 옮기는 방향으로 읽힙니다.`}
          </p>
        </div>
      </div>
    </section>
  );
}
