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
      className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm p-6 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]"
    >
      {/* Header: 문항 번호 + 삭제 */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-400/20 text-xs font-bold text-cyan-400 tabular-nums">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-zinc-400">
            문항 {index + 1}
          </span>
        </div>

        {canDelete && (
          <button
            onClick={() => onDelete(item.id)}
            className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label={`문항 ${index + 1} 삭제`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 질문 입력 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          질문
        </label>
        <Input
          value={item.question}
          onChange={e => onUpdate(item.id, "question", e.target.value)}
          maxLength={300}
          placeholder="예) 지원 동기를 작성해 주세요."
          className="border-white/[0.08] bg-white/[0.04] text-white placeholder:text-zinc-600 rounded-xl h-12 px-4 text-[15px] focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all"
        />
      </div>

      {/* 답변 입력 */}
      <div className="relative">
        <label className="block text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wider">
          답변
        </label>
        <Textarea
          value={item.answer}
          onChange={e => onUpdate(item.id, "answer", e.target.value)}
          placeholder="여기에 답변을 작성해 주세요."
          rows={8}
          className="w-full border-white/[0.08] bg-white/[0.04] text-white rounded-xl p-4 text-[15px] leading-relaxed resize-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-zinc-600"
        />
        {/* 개별 글자 수 */}
        <div className="absolute bottom-3 right-4 text-xs text-zinc-600 tabular-nums pointer-events-none">
          {charCount.toLocaleString()}자
        </div>
      </div>
    </motion.div>
  );
}
