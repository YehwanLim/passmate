import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, FileSearch, FileText } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";

const LOADING_STEPS = {
  1: {
    icon: FileSearch,
    title: "자소서를 한 줄씩 읽고 있어요",
    label: UI_LABELS.LOADING_STEP_1,
    accent: "text-sky-400",
  },
  2: {
    icon: BarChart3,
    title: "합격 신호를 찾는 중이에요",
    label: UI_LABELS.LOADING_STEP_2,
    accent: "text-cyan-400",
  },
  3: {
    icon: FileText,
    title: "인사이트 리포트를 정리하고 있어요",
    label: UI_LABELS.LOADING_STEP_3,
    accent: "text-emerald-400",
  },
} as const;

/** 접수 중 전체 화면 오버레이. 7초·30초에 단계 문구가 바뀐다. */
export default function AnalyzeLoadingOverlay({ isLoading }: { isLoading: boolean }) {
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(0);
      return;
    }
    setLoadingStep(1);
    const t1 = setTimeout(() => setLoadingStep(2), 7000);
    const t2 = setTimeout(() => setLoadingStep(3), 30000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoading]);

  const currentLoadingStep =
    LOADING_STEPS[(loadingStep || 1) as keyof typeof LOADING_STEPS];
  const LoadingIcon = currentLoadingStep.icon;

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed inset-0 z-[100] bg-[#0A0A0A] flex flex-col items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Pulsing gradient ring */}
          <div className="relative mb-10">
            <svg
              className="w-24 h-24 animate-spin"
              style={{ animationDuration: "3s" }}
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="4"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="url(#loadGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="80 200"
              />
              <defs>
                <linearGradient
                  id="loadGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#22D3EE" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={loadingStep}
                  initial={{ opacity: 0, scale: 0.75, rotate: -8 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.75, rotate: 8 }}
                  transition={{ duration: 0.35 }}
                >
                  <LoadingIcon
                    className={`w-8 h-8 ${currentLoadingStep.accent} animate-pulse`}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <motion.p
            key={`loading-title-${loadingStep}`}
            className="text-xl font-semibold text-white mb-6 tracking-tight"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {currentLoadingStep.title}
          </motion.p>

          {/* 3단계 도트 인디케이터 */}
          <div className="flex items-center gap-3 mb-4">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  loadingStep >= step
                    ? "bg-cyan-400 scale-110 shadow-sm shadow-cyan-400/40"
                    : "bg-zinc-700"
                }`}
              />
            ))}
          </div>

          {/* 상태 텍스트 (fade 전환) */}
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-sm text-zinc-500 mb-10"
            >
              {currentLoadingStep.label}
            </motion.p>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
