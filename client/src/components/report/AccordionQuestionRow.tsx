import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** 면접 예상 질문 한 줄(Q{n} + 질문 + 화살표). 펼치면 children 을 보여 준다. */
export function AccordionQuestionRow({
  index,
  question,
  open,
  onToggle,
  children,
}: {
  index: number;
  question: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-line-soft first:border-t-0">
      <button onClick={onToggle} aria-expanded={open} className="w-full py-5 flex items-start gap-4 text-left group">
        <span className="w-8 shrink-0 pt-px text-[15px] font-semibold tabular-nums text-ink-5">Q{index + 1}</span>
        <span className="min-w-0 flex-1 text-[16px] font-bold text-ink-2 group-hover:text-ink transition-colors leading-[1.55]">{question}</span>
        <ChevronDown aria-hidden="true" className={`size-5 shrink-0 text-ink-5 transition-transform duration-200 mt-0.5 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? children : null}
    </div>
  );
}
