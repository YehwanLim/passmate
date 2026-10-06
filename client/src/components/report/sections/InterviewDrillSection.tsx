import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { InterviewQA } from "@/types/report";
import { AccordionQuestionRow } from "../AccordionQuestionRow";
import { renderEmphasizedText, renderRichText } from "../richText";

/** 예상 질문: 질문·꼬리 질문·모범 답변 아코디언. "더 자세히" 칸 안에 들어가고, 인쇄 중에는 전부 펼친다. */
export function InterviewDrillSection({ items, isPrinting }: { items: InterviewQA[]; isPrinting: boolean }) {
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0);

  return (
    <div id="section-interview-drill" className="report-section-anchor">
      <p className="mb-2 text-[15px] leading-[1.7] text-ink-3">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

      <div>
        {items.map((item, index) => (
          <AccordionQuestionRow
            key={index}
            tone="light"
            index={index}
            question={renderRichText(item.question)}
            open={openQuestionIndex === index || isPrinting}
            onToggle={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
          >
            <div className="mb-5 space-y-4 rounded-2xl bg-fill-soft px-5 py-4 sm:ml-[64px]">
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
          </AccordionQuestionRow>
        ))}
      </div>
    </div>
  );
}
