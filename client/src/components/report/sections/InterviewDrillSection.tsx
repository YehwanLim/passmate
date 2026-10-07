import { ArrowRight } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { InterviewQA } from "@/types/report";
import { renderEmphasizedText, renderRichText } from "../richText";

/** 예상 질문: 질문마다 꼬리 질문·모범 답변을 펼친 채로 보여 준다(접지 않는다). */
export function InterviewDrillSection({ items }: { items: InterviewQA[] }) {
  return (
    <div>
      <p className="text-[15px] leading-[1.7] text-ink-3">{UI_LABELS.INTERVIEW_DRILL_DESC}</p>

      <ol className="mt-4">
        {items.map((item, index) => (
          <li key={index} className="grid gap-3 border-t border-line-soft py-5 sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-0">
            <span className="text-[15px] font-semibold tabular-nums text-ink-5">Q{index + 1}</span>
            <div className="min-w-0">
              <p className="text-[16px] font-bold leading-[1.55] text-ink">{renderRichText(item.question)}</p>
              <div className="mt-3 space-y-4 rounded-2xl bg-fill-soft px-5 py-4">
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
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
