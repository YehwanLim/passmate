import { AlertTriangle, Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { HiringMemoryItem, MentorCommentBlock } from "@/pages/reportFirstImpression";
import { MENTOR_COMMENT_STYLES } from "@/pages/reportStyles";
import { ReportHeroFrame } from "../ReportHeroFrame";
import { renderCleanText } from "../richText";

/** ACT 1 — 첫인상 표지: 페르소나, 한 줄 요약, 키워드, 채용담당자 기억, 프로필, 현직자 코멘트. */
export function FirstImpressionSection({
  displayName,
  targetCompany,
  heroPersona,
  heroPersonaLines,
  heroSummary,
  editorialKeywords,
  hiringMemoryItems,
  profileNote,
  mentorCommentBlocks,
}: {
  displayName: string;
  targetCompany: string;
  heroPersona: string;
  heroPersonaLines: string[];
  heroSummary: string;
  editorialKeywords: string[];
  hiringMemoryItems: HiringMemoryItem[];
  profileNote: string | undefined;
  mentorCommentBlocks: MentorCommentBlock[];
}) {
  return (
    <header id="section-first-impression" className="pt-8 pb-[6.5rem] section-divider">
      <ReportHeroFrame eyebrow={<>First Read · {targetCompany}</>}>
        <div className="relative min-w-0 py-12 text-center sm:py-14 md:py-[4.25rem]">
          <p className="mb-5 text-[15px] sm:text-base text-zinc-300">{displayName}님은</p>
          <h1 className="mx-auto max-w-3xl text-[2.08rem] sm:text-[3.15rem] md:text-[4.05rem] font-semibold leading-[1.04] tracking-tight text-white">
            {heroPersonaLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[16px] sm:text-[19px] leading-[1.8] text-zinc-300 text-balance">
            {renderCleanText(heroSummary)}
          </p>
        </div>

        <div className="relative flex min-w-0 flex-wrap justify-center gap-2.5 pb-8">
          {editorialKeywords.map((keyword) => (
            <span key={keyword} className="max-w-full rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-zinc-300 transition-colors duration-200 hover:border-cyan-300/25 hover:bg-cyan-300/[0.07] hover:text-zinc-100">
              {keyword}
            </span>
          ))}
        </div>

        <div className="relative grid items-start gap-5 md:grid-cols-2">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
            <p className="mb-3 text-sm font-semibold text-white">채용담당자가 기억할 모습</p>
            <ul className="space-y-3">
              {hiringMemoryItems.map((item) => (
                <li key={`${item.mark}-${item.text}`} className="grid grid-cols-[22px_1fr] gap-2.5 text-sm leading-[1.68] text-zinc-300">
                  <span className={`mt-0.5 inline-flex size-[18px] items-center justify-center rounded-full border ${item.mark === "✓" ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200" : "border-amber-300/30 bg-amber-400/10 text-amber-200"}`}>
                    {item.mark === "✓" ? <Check className="size-3" /> : <AlertTriangle className="size-3" />}
                  </span>
                  <span className="pt-px">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-5">
            <p className="mb-3 text-sm font-semibold text-white">{UI_LABELS.APPLICANT_PROFILE}</p>
            <p className="text-sm leading-[1.82] text-zinc-400">
              {profileNote?.trim()
                ? renderCleanText(profileNote)
                : `${heroPersona}라는 인상이 먼저 남습니다. 경험의 흐름은 문제를 발견하고 근거를 모아 실행으로 옮기는 방향으로 읽힙니다.`}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 md:col-span-2">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">현직자 코멘트</p>
            <div className="grid gap-5 md:grid-cols-3">
              {mentorCommentBlocks.map((block, index) => {
                const style = MENTOR_COMMENT_STYLES[index];
                if (!style) return null;

                return (
                  <blockquote key={block.title} className="min-w-0">
                    <div className="mb-4 flex items-center gap-3">
                      <span className={`text-[32px] font-extrabold leading-none tracking-[0.08em] opacity-60 ${style.numberClassName}`}>{String(index + 1).padStart(2, "0")}</span>
                      <p className="text-[15px] font-bold text-zinc-100">
                        {style.title}
                      </p>
                    </div>
                    <p className="text-sm leading-[1.82] text-zinc-300">{renderCleanText(block.text)}</p>
                  </blockquote>
                );
              })}
            </div>
          </div>
        </div>
      </ReportHeroFrame>
    </header>
  );
}
