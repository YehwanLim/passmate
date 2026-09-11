import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

import AuthButton from "@/components/AuthButton";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";

/** 자소서 분석·기업 분석 폼이 함께 쓰는 껍데기: 등장 모션, GNB, 하단 바, 에러 모달. */

export const ANALYZE_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

export const ANALYZE_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export const ANALYZE_SUBMIT_BUTTON_CLASS =
  "bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white px-6 py-3 text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-cyan-500/25 transition-all disabled:opacity-40 disabled:shadow-none whitespace-nowrap flex-shrink-0";

export function AnalyzeNav() {
  const [, navigate] = useLocation();

  return (
    <motion.nav
      className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-lg border-b border-white/5"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div
            className="flex items-center cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Logo className="h-6 w-auto" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="text-[13px] text-gray-300 hover:text-white hover:bg-white/10 font-medium h-8 px-3 rounded-md transition-colors duration-200"
            onClick={() => navigate("/my")}
          >
            내 지원서
          </button>
          <AuthButton />
        </div>
      </div>
    </motion.nav>
  );
}

export function AnalyzeBottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0A0A0A]/90 backdrop-blur-xl">
      <div className="container max-w-3xl mx-auto px-4 flex flex-col">
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
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {error.title}
              </h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              {error.message}
            </p>
            {error.actionHref && error.actionLabel && (
              <Button
                onClick={() => {
                  const href = error.actionHref;
                  onClose();
                  if (href) navigate(href);
                }}
                className="w-full mb-2 bg-white hover:bg-zinc-200 text-black rounded-xl h-11 text-sm font-semibold transition-colors"
              >
                {error.actionLabel}
              </Button>
            )}
            <Button
              onClick={onClose}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl h-11 text-sm font-medium transition-colors"
            >
              확인
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
