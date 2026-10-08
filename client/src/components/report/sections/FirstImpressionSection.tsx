import type { ReactNode } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { HiringMemoryItem } from "@/pages/reportFirstImpression";
import { renderCleanText } from "../richText";

function ReadingStep({ time, label, tone, last, children }: { time: string; label: string; tone: "ok" | "fix"; last?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div aria-hidden="true" className="hidden items-center md:flex">
        <span
          className={`size-3.5 shrink-0 rounded-full ${tone === "ok" ? "bg-ok shadow-[0_0_0_5px_var(--color-ok-soft)]" : "bg-[#B97800] shadow-[0_0_0_5px_var(--color-blank-soft)]"}`}
        />
        <span className={`ml-3 h-0.5 flex-1 ${last ? "bg-transparent" : "bg-line"}`} />
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-ink">{time}</span>
        <span className="text-[14px] font-semibold text-ink-4">{label}</span>
      </p>
      {children}
    </div>
  );
}

/**
 * 01 첫인상(리포트 표지): 위는 이름표 띠(이니셜·읽히는 모습 | 지원자 프로필·키워드),
 * 아래는 채용 담당자가 읽는 순서대로 10초(총평) · 1분(기억할 모습 ✓) · 3분(남는 질문 △) 세 칸.
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
  const remembered = hiringMemoryItems.filter((item) => item.mark === "✓");
  const questions = hiringMemoryItems.filter((item) => item.mark !== "✓");

  return (
    <section id="section-first-impression" className="report-section-anchor rounded-3xl bg-surface px-5 py-7 sm:px-10 sm:py-10">
      <p className="text-[14px] font-bold text-ink-4">
        <span className="mr-2 tabular-nums text-ink-5">{index}</span>
        {UI_LABELS.REPORT_NAV_FIRST_IMPRESSION}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_340px] md:items-center md:gap-8">
        <div className="flex items-center gap-4 sm:gap-5">
          <span
            aria-hidden="true"
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-navy text-[22px] font-extrabold text-white sm:size-[72px] sm:text-[28px]"
          >
            {displayName.trim().charAt(0) || "지"}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink-4">{displayName}님은 채용 담당자에게 이렇게 읽혀요</p>
            {/* 낱말 가운데서 끊기지 않게(break-keep) 하고, 반으로 나눈 줄이 칸보다 길면 줄 길이를 고르게(text-balance) */}
            <h1 className="mt-1.5 break-keep text-[26px] font-bold leading-[1.3] tracking-[-0.03em] text-navy text-balance sm:text-[32px]">
              {heroPersonaLines.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </h1>
          </div>
        </div>
        <div>
          <p className="text-[13px] font-bold text-ink-5">{UI_LABELS.APPLICANT_PROFILE}</p>
          <p className="mt-1.5 break-keep text-[14px] leading-[1.7] text-ink-2 text-pretty">
            {profileNote?.trim()
              ? renderCleanText(profileNote)
              : `${heroPersona}라는 인상이 먼저 남습니다. 경험의 흐름은 문제를 발견하고 근거를 모아 실행으로 옮기는 방향으로 읽힙니다.`}
          </p>
          {keywords.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {keywords.map((keyword) => (
                <li key={keyword} className="rounded-[10px] border border-line bg-fill-soft px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-3">
                  #{keyword.replace(/^#/, "")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-8 border-t border-line-soft pt-7">
        <p className="text-[16px] font-bold text-ink">채용 담당자가 읽는 순서대로</p>
        <div className="mt-4 grid gap-6 md:grid-cols-3 md:gap-5">
          <ReadingStep time="10초" label="처음 보이는 것" tone="ok">
            <p className="break-keep rounded-2xl bg-fill-soft px-5 py-4 text-[16px] font-medium leading-[1.6] text-ink text-pretty">{renderCleanText(heroSummary)}</p>
          </ReadingStep>
          <ReadingStep time="1분" label={UI_LABELS.HIRING_MEMORY_SHORT} tone="ok">
            <ul className="flex flex-col gap-2" aria-label={UI_LABELS.HIRING_MEMORY}>
              {remembered.map((item) => (
                <li key={item.text} className="flex items-center gap-3 break-keep rounded-[14px] bg-fill-soft px-3.5 py-3 text-[15px] font-medium leading-[1.45] text-ink text-pretty">
                  <span aria-hidden="true" className="inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
                    <Check className="size-3" strokeWidth={3.2} />
                  </span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </ReadingStep>
          <ReadingStep time="3분" label="다 읽고 남는 질문" tone="fix" last>
            {questions.map((item) => (
              <div key={item.text} className="flex flex-col gap-2.5 rounded-2xl bg-blank-soft px-5 py-4">
                <AlertTriangle aria-hidden="true" className="size-5 text-blank" strokeWidth={2.2} />
                <p className="break-keep text-[17px] font-semibold leading-[1.45] text-ink text-pretty">{item.text}</p>
                <p className="text-[14px] leading-[1.6] text-ink-3">면접에서 먼저 물어볼 수 있는 부분이에요. 아래 핵심 진단에서 채우는 법을 봐요.</p>
              </div>
            ))}
          </ReadingStep>
        </div>
      </div>
    </section>
  );
}
