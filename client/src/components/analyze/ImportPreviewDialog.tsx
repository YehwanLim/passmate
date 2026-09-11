import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ResumeImportPair } from "@/lib/resumeFileImport";

/** PDF/Word 에서 나눈 문항을 적용하기 전에 보여 주는 미리보기 모달. */
export default function ImportPreviewDialog({
  pairs,
  willOverwrite,
  onApply,
  onCancel,
}: {
  pairs: ResumeImportPair[] | null;
  /** 이미 입력된 문항이 있어 적용 시 덮어쓰는지 */
  willOverwrite: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {pairs && (
        <motion.div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-import-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#141414] shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/[0.08] px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-cyan-300">
                  파일 불러오기
                </p>
                <h2
                  id="file-import-title"
                  className="text-lg font-semibold text-white"
                >
                  문항 나누기 미리보기
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.07] hover:text-white"
                aria-label="미리보기 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(55vh,480px)] space-y-3 overflow-y-auto p-4">
              {pairs.map((pair, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5"
                >
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-cyan-300">
                    문항 {index + 1}
                  </p>
                  <p className="text-sm font-medium text-zinc-100">
                    {pair.question || "질문 없음 — 채운 뒤 직접 입력해 주세요"}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-400 line-clamp-4">
                    {pair.answer}
                  </p>
                  <p className="mt-2 text-right text-[11px] tabular-nums text-zinc-600">
                    {pair.answer.length.toLocaleString()}자
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-white/[0.08] px-6 py-4">
              <p className="mb-3 text-xs leading-relaxed text-zinc-500">
                나눈 결과가 어색하면 채운 뒤 자유롭게 고칠 수 있어요.
                {willOverwrite && " 적용하면 지금 입력된 문항을 덮어써요."}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="h-10 border-white/[0.1] bg-white/[0.02] px-4 text-sm font-medium text-zinc-300 hover:bg-white/[0.06]"
                >
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={onApply}
                  className="h-10 bg-cyan-500 px-4 text-sm font-semibold text-black hover:bg-cyan-400"
                >
                  이대로 채우기
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
