import { UI_LABELS } from "@/constants/labels";
import type { MentorCommentBlock } from "@/pages/reportFirstImpression";
import { SectionNumber } from "../SectionNumber";
import { renderEmphasizedText } from "../richText";

/** ACT 6 — 실무자 코멘트를 타임스탬프 달린 스레드처럼 보여 준다. */
export function MentorCommentSection({ blocks }: { blocks: MentorCommentBlock[] }) {
  return (
    <section id="section-pm-comment" className="pt-24 pb-20 section-divider">
      <h3 className="text-xl sm:text-2xl font-medium text-white mb-10 tracking-tight"><SectionNumber value="07" />{UI_LABELS.PM_VERDICT_TITLE}</h3>
      <div className="mentor-comment-thread relative">
        {blocks.map((block, index) => (
          <article
            key={block.title}
            className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4 pb-8 last:pb-0 sm:grid-cols-[2.75rem_minmax(0,1fr)] sm:gap-5"
          >
            {index < blocks.length - 1 && (
              <span aria-hidden="true" className="absolute left-5 top-12 bottom-0 w-px bg-white/[0.06] sm:left-[22px]" />
            )}
            <div className="relative z-10 flex size-10 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 sm:size-11">
              <span className="text-xs font-bold tracking-tight text-indigo-400">H</span>
            </div>
            <div className="min-w-0 pt-0.5">
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm font-medium text-white">Mentor Hansi</span>
                <span className="text-xs text-zinc-600">{UI_LABELS.JUST_NOW}</span>
              </div>
              <h4 className="mb-3 text-[18px] font-semibold tracking-tight text-zinc-100">{block.title}</h4>
              <p className="text-[17px] font-normal leading-[1.8] text-zinc-200">{renderEmphasizedText(block.text)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
