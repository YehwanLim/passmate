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
          className="fixed inset-0 z-[210] flex items-center justify-center bg-ink/40 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="file-import-title"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18 }}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <div>
                <p className="mb-1 text-xs font-medium tracking-wide text-brand-ink">
                  파일 불러오기
                </p>
                <h2
                  id="file-import-title"
                  className="text-lg font-semibold text-ink"
                >
                  문항 나누기 미리보기
                </h2>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg p-2 text-ink-4 transition-colors hover:bg-fill hover:text-ink"
                aria-label="미리보기 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(55vh,480px)] space-y-3 overflow-y-auto p-4">
              {pairs.map((pair, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-line bg-surface px-4 py-3.5"
                >
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-brand-ink">
                    문항 {index + 1}
                  </p>
                  <p className="text-sm font-medium text-ink">
                    {pair.question || "질문 없음 — 채운 뒤 직접 입력해 주세요"}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-ink-3 line-clamp-4">
                    {pair.answer}
                  </p>
                  <p className="mt-2 text-right text-[11px] tabular-nums text-ink-5">
                    {pair.answer.length.toLocaleString()}자
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-line px-6 py-4">
              <p className="mb-3 text-xs leading-relaxed text-ink-4">
                나눈 결과가 어색하면 채운 뒤 자유롭게 고칠 수 있어요.
                {willOverwrite && " 적용하면 지금 입력된 문항을 덮어써요."}
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  className="h-10 border-line bg-surface px-4 text-sm font-medium text-ink-2 hover:bg-fill"
                >
                  취소
                </Button>
                <Button
                  type="button"
                  onClick={onApply}
                  className="h-10 bg-brand px-4 text-sm font-semibold text-ink hover:bg-brand-hover"
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
