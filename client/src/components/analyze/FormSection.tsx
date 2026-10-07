import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { ANALYZE_ITEM_VARIANTS } from "./AnalyzeShell";

/** 분석 폼의 칸 한 장: 제목 + 필수/선택 + 입력 영역. */
export default function FormSection({
  title,
  required = false,
  className,
  tone = "card",
  children,
}: {
  title: string;
  required?: boolean;
  className?: string;
  /** card: 분석 폼의 흰 카드 한 장. light: 이미 흰 카드인 화면(작업실) 안에 넣을 때 — 제목만. */
  tone?: "card" | "light";
  children: ReactNode;
}) {
  if (tone === "light") {
    return (
      <div className={cn("space-y-5", className)}>
        <h2 className="text-[16px] font-bold text-ink">{title}</h2>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      variants={ANALYZE_ITEM_VARIANTS}
      className={cn("mb-5 space-y-6 rounded-3xl bg-surface px-5 py-6 sm:px-8 sm:py-7", className)}
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-[17px] font-bold text-ink">{title}</h2>
        <span className={cn("text-[13px] font-semibold", required ? "text-brand-ink" : "text-ink-5")}>
          {required ? "필수" : "선택"}
        </span>
      </div>
      {children}
    </motion.div>
  );
}
