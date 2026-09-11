import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ANALYZE_ITEM_VARIANTS } from "./AnalyzeShell";

/** 분석 폼의 카드 한 장: 아이콘 칩 + 제목 + 필수/선택 배지 + 입력 영역. */
export default function FormSection({
  icon: Icon,
  accent = false,
  title,
  required = false,
  className,
  children,
}: {
  icon: LucideIcon;
  /** 파란 그라데이션 칩(핵심 입력). 기본은 무채색 칩. */
  accent?: boolean;
  title: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={ANALYZE_ITEM_VARIANTS}
      className={cn(
        "mb-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-7",
        className
      )}
    >
      <div className="flex items-center gap-2.5 mb-1">
        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center",
            accent
              ? "bg-gradient-to-br from-blue-500/20 to-cyan-400/20"
              : "bg-white/[0.06]"
          )}
        >
          <Icon className={cn("w-3.5 h-3.5", accent ? "text-cyan-400" : "text-zinc-300")} />
        </div>
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {required ? (
          <span className="text-[11px] text-cyan-300 bg-cyan-400/[0.08] px-2 py-0.5 rounded-full">
            필수
          </span>
        ) : (
          <span className="text-[11px] text-zinc-600 bg-white/[0.06] px-2 py-0.5 rounded-full">
            선택
          </span>
        )}
      </div>
      {children}
    </motion.div>
  );
}
