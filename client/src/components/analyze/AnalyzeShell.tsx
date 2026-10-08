import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";

import { Button } from "@/components/ui/button";

/** 자소서 분석·기업 분석 폼이 함께 쓰는 껍데기: 등장 모션, 하단 바, 에러 모달. 상단 메뉴는 components/SiteHeader.tsx. */

export const ANALYZE_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

/** 편집기 틀(자소서·기업 분석) 하단의 큰 분석 버튼. 폰은 막대 폭을 꽉 채운다. */
export const ANALYZE_BIG_SUBMIT_BUTTON_CLASS =
  "h-14 flex-1 rounded-2xl bg-brand px-8 text-[17px] font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-40 whitespace-nowrap sm:flex-none sm:min-w-[260px]";

export function AnalyzeBottomBar({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className={`container ${wide ? "max-w-6xl" : "max-w-3xl"} mx-auto px-4 flex flex-col`}>
        {children}
      </div>
    </div>
  );
}

export interface AnalyzeErrorView {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}

export function AnalyzeErrorModal({
  error,
  onClose,
}: {
  error: AnalyzeErrorView | null;
  onClose: () => void;
}) {
  const [, navigate] = useLocation();

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-surface border border-line rounded-2xl w-full max-w-md p-6 shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-danger-soft flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-danger" />
              </div>
              <h3 className="text-lg font-semibold text-ink">
                {error.title}
              </h3>
            </div>
            <p className="text-sm text-ink-3 leading-relaxed mb-6">
              {error.message}
            </p>
            {error.actionHref && error.actionLabel && (
              <Button
                onClick={() => {
                  const href = error.actionHref;
                  onClose();
                  if (href) navigate(href);
                }}
                className="w-full mb-2 bg-brand hover:bg-brand-hover text-white rounded-xl h-11 text-sm font-semibold transition-colors"
              >
                {error.actionLabel}
              </Button>
            )}
            <Button
              onClick={onClose}
              className="w-full bg-fill hover:bg-line text-ink-2 rounded-xl h-11 text-sm font-medium transition-colors"
            >
              확인
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
