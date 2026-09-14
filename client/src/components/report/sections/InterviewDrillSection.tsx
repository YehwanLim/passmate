import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { InterviewQA } from "@/types/report";
import { AccordionQuestionRow } from "../AccordionQuestionRow";
import { SectionNumber } from "../SectionNumber";
import { renderEmphasizedText, renderRichText } from "../richText";

/** ACT 4 — 예상 질문: 질문·꼬리 질문·모범 답변 아코디언. 인쇄 중에는 전부 펼친다. */
export function InterviewDrillSection({ items, isPrinting, indexLabel = "05" }: { items: InterviewQA[]; isPrinting: boolean; indexLabel?: string }) {
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(0);

  return (
    <section id="section-interview-drill" className="pt-24 pb-24 section-divider report-section-anchor">
      <h3 className="text-2xl sm:text-3xl font-semibold text-white mb-6 tracking-tight"><SectionNumber value={indexLabel} />{UI_LABELS.INTERVIEW_DRILL_TITLE}</h3>
      <p className="text-base text-zinc-400 mb-14 max-w-2xl leading-[1.7]">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

      <div className="space-y-0">
        {items.map((item, index) => (
          <AccordionQuestionRow
            key={index}
            index={index}
            question={renderRichText(item.question)}
            open={openQuestionIndex === index || isPrinting}
            onToggle={() => setOpenQuestionIndex(openQuestionIndex === index ? null : index)}
          >
            <div className="pb-8 pl-[70px] space-y-4">
              {item.followUps && item.followUps.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-amber-300/50 mb-3 font-medium">{UI_LABELS.FOLLOW_UP_QUESTIONS}</p>
                  <ul className="space-y-2">
                    {item.followUps.map((fu, fi) => (
                      <li key={fi} className="text-[15px] text-zinc-500 leading-[1.7] flex items-start gap-2.5">
                        <ArrowRight className="w-3 h-3 text-amber-300/35 mt-1.5 shrink-0" />{renderRichText(fu)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs uppercase tracking-[0.12em] text-zinc-500 mb-3 font-medium">{UI_LABELS.MODEL_ANSWER}</p>
              <p className="text-[15px] text-zinc-400 leading-[1.8]">{renderEmphasizedText(item.modelAnswer)}</p>
            </div>
          </AccordionQuestionRow>
        ))}
      </div>
    </section>
  );
}
