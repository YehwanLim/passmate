import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { InterviewQA } from "@/types/report";
import { renderEmphasizedText, renderRichText } from "../richText";

/** 예상 질문: 질문 줄을 누르면 꼬리 질문·모범 답변이 펼쳐진다. 처음엔 첫 질문만, 인쇄 중에는 전부 펼친다. */
export function InterviewDrillSection({ items, isPrinting }: { items: InterviewQA[]; isPrinting: boolean }) {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(() => new Set([0]));

  const toggle = (index: number) =>
    setOpenIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <ol>
      {items.map((item, index) => {
        const open = isPrinting || openIndexes.has(index);
        return (
          <li key={index} className="border-t border-line-soft first:border-t-0">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(index)}
              className="group flex w-full items-start gap-4 py-5 text-left"
            >
              <span className="w-8 shrink-0 pt-px text-[15px] font-semibold tabular-nums text-ink-5">Q{index + 1}</span>
              <span className="min-w-0 flex-1 text-[16px] font-bold leading-[1.55] text-ink-2 group-hover:text-ink">{renderRichText(item.question)}</span>
              <ChevronDown aria-hidden="true" className={`mt-0.5 size-5 shrink-0 text-ink-5 transition-transform duration-200 print:hidden ${open ? "rotate-180" : ""}`} />
            </button>
            {open ? (
              <div className="mb-5 space-y-4 rounded-2xl bg-fill-soft px-5 py-4 sm:ml-12">
                {item.followUps && item.followUps.length > 0 && (
                  <div>
                    <p className="mb-2 text-[13px] font-bold text-blank">{UI_LABELS.FOLLOW_UP_QUESTIONS}</p>
                    <ul className="space-y-1.5">
                      {item.followUps.map((fu, fi) => (
                        <li key={fi} className="flex items-start gap-2 text-[15px] leading-[1.65] text-ink-3">
                          <ArrowRight className="mt-[5px] size-3.5 shrink-0 text-ink-5" />{renderRichText(fu)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="mb-2 text-[13px] font-bold text-ink-4">{UI_LABELS.MODEL_ANSWER}</p>
                  <p className="text-[15px] leading-[1.75] text-ink-3">{renderEmphasizedText(item.modelAnswer)}</p>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
