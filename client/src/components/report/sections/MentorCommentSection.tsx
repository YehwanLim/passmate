import { UI_LABELS } from "@/constants/labels";
import type { MentorCommentBlock } from "@/pages/reportFirstImpression";
import { renderEmphasizedText } from "../richText";

/** 실무자 코멘트를 이름 달린 글처럼 보여 준다. ReportBlock 안에 들어간다. */
export function MentorCommentSection({ blocks }: { blocks: MentorCommentBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <article key={block.title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-[#EEF1F6]">
            <span className="text-[13px] font-extrabold text-navy">H</span>
          </div>
          <div className="min-w-0 pt-0.5">
            <div className="mb-1 flex items-center gap-2.5">
              <span className="text-[14px] font-semibold text-ink-2">Mentor Hansi</span>
              <span className="text-[13px] text-ink-5">{UI_LABELS.JUST_NOW}</span>
            </div>
            <h4 className="mb-1.5 text-[16px] font-bold text-ink">{block.title}</h4>
            <p className="text-[15px] leading-[1.8] text-ink-2">{renderEmphasizedText(block.text)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
