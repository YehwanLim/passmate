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
    <div className="border-b border-white/[0.04] last:border-0">
      <button onClick={onToggle} aria-expanded={open} className="w-full py-6 flex items-start gap-5 text-left group">
        <span className="text-xs uppercase tracking-[0.12em] text-zinc-500 mt-1 min-w-[50px] font-medium">Q{index + 1}</span>
        <span className="flex-1 text-[17px] text-zinc-300 group-hover:text-white transition-colors leading-[1.6]">{question}</span>
        <ChevronDown aria-hidden="true" className={`w-5 h-5 text-zinc-600 transition-transform mt-0.5 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? children : null}
    </div>
  );
}
