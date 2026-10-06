import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

// dark: 기업 분석 리포트(어두운 화면). light: 10월 밝은 디자인으로 바꾼 자소서 리포트.
const TONE = {
  dark: {
    row: "border-b border-white/[0.04] last:border-0",
    button: "py-6",
    index: "text-xs uppercase tracking-[0.12em] text-zinc-500 mt-1 min-w-[50px] font-medium",
    question: "flex-1 text-[17px] text-zinc-300 group-hover:text-white transition-colors leading-[1.6]",
    chevron: "text-zinc-600",
  },
  light: {
    row: "border-b border-line-soft last:border-0",
    button: "py-5",
    index: "text-[15px] tabular-nums text-ink-5 mt-px min-w-[44px] font-semibold",
    question: "flex-1 text-[16px] font-semibold text-ink-2 group-hover:text-ink transition-colors leading-[1.55]",
    chevron: "text-ink-5",
  },
} as const;

/** 면접 예상 질문 한 줄(Q{n} + 질문 + 화살표). 펼치면 children 을 보여 준다. */
export function AccordionQuestionRow({
  index,
  question,
  open,
  onToggle,
  children,
  tone = "dark",
}: {
  index: number;
  question: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  tone?: keyof typeof TONE;
}) {
  const style = TONE[tone];
  return (
    <div className={style.row}>
      <button onClick={onToggle} aria-expanded={open} className={`w-full ${style.button} flex items-start gap-5 text-left group`}>
        <span className={style.index}>Q{index + 1}</span>
        <span className={style.question}>{question}</span>
        <ChevronDown aria-hidden="true" className={`w-5 h-5 transition-transform mt-0.5 ${style.chevron} ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? children : null}
    </div>
  );
}
