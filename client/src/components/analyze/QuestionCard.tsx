import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionItem } from "@/pages/analyzeQuestions";

/** 자소서 문항 하나: 질문 입력 + 답변 입력 + 개별 글자 수. */
export default function QuestionCard({
  item,
  index,
  canDelete,
  onUpdate,
  onDelete,
}: {
  item: QuestionItem;
  index: number;
  canDelete: boolean;
  onUpdate: (id: string, field: "question" | "answer", value: string) => void;
  onDelete: (id: string) => void;
}) {
  const charCount = item.answer.length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.96 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="group relative rounded-3xl bg-surface px-5 py-6 sm:px-8 sm:py-7"
    >
      {/* Header: 문항 번호 + 삭제 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="text-[17px] font-bold text-ink">
            문항 {index + 1}
          </span>
        </div>

        {canDelete && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 rounded-lg text-ink-5 hover:text-danger hover:bg-danger-soft transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={`문항 ${index + 1} 삭제`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 질문 입력 */}
      <div className="mb-4">
        <label className="block text-[13px] font-semibold text-ink-3 mb-2">
          질문
        </label>
        <Input
          value={item.question}
          onChange={e => onUpdate(item.id, "question", e.target.value)}
          maxLength={300}
          placeholder="예) 지원 동기를 작성해 주세요."
          className="border-line bg-surface text-ink placeholder:text-ink-5 rounded-xl h-12 px-4 text-[15px] focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all"
        />
      </div>

      {/* 답변 입력 */}
      <div className="relative">
        <label className="block text-[13px] font-semibold text-ink-3 mb-2">
          답변
        </label>
        <Textarea
          value={item.answer}
          onChange={e => onUpdate(item.id, "answer", e.target.value)}
          placeholder="여기에 답변을 작성해 주세요."
          rows={8}
          className="w-full border-line bg-surface text-ink rounded-xl p-4 text-[15px] leading-relaxed resize-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-all placeholder:text-ink-5"
        />
        {/* 개별 글자 수 */}
        <div className="absolute bottom-3 right-4 text-xs text-ink-5 tabular-nums pointer-events-none">
          {charCount.toLocaleString()}자
        </div>
      </div>
    </motion.div>
  );
}
