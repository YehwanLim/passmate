import { motion } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import { BrandName } from "@/components/BrandName";
import {
  REPORT_PREVIEW_SCENES,
  hiringMemoryItems,
  mentorCommentPreviews,
  reportKeywords,
} from "@/components/ReportShowcase";

/* ─────────────────────────────────────────────────────────
   HeroReportCard — 히어로에 리포트 첫인상 화면을 축소해 거는 미리보기.
   콘텐츠·색 체계는 ReportShowcase의 데이터를 그대로 재사용한다.
   ───────────────────────────────────────────────────────── */

export default function HeroReportCard() {
  return (
    <motion.div
      className="relative mx-auto mt-16 w-full max-w-[880px] text-left md:mt-20"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.95, duration: 1, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      <div
        className="pointer-events-none absolute -inset-x-[10%] -inset-y-[6%] -z-10 blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(59,130,246,0.1) 0%, transparent 68%)",
        }}
      />

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0A0A0A]/95 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 md:px-7">
          <div className="absolute inset-x-[8%] top-0 h-px bg-gradient-to-r from-transparent via-blue-400/40 to-transparent" />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            <BrandName /> Report
          </span>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_PREVIEW_SCENES.map((scene, index) => (
              <span
                key={scene.id}
                className={`rounded-lg border px-2.5 py-1 text-[11px] ${
                  index === 0
                    ? "border-blue-500/[0.28] bg-blue-500/[0.12] text-blue-200"
                    : "hidden border-white/[0.07] text-zinc-500 sm:inline-block"
                }`}
              >
                {scene.indexLabel}. {scene.tab}
              </span>
            ))}
          </div>
        </div>

        <div className="px-5 pb-6 pt-5 md:px-7 md:pb-7">
          <div className="py-2 text-center md:py-3">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              First Read · 현대자동차 · 서비스 기획
            </p>
            <p className="mb-2 mt-4 text-[13px] text-zinc-300">김민지님은</p>
            <h3 className="mx-auto text-[1.7rem] font-semibold leading-[1.08] tracking-tight text-white md:text-[2.2rem]">
              <span className="block">데이터 기반</span>
              <span className="block">실행형 PM</span>
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-[1.7] text-zinc-300 md:text-[14px]">
              데이터 기반 실행력은 강하지만, 현대자동차 기준 모빌리티 임팩트
              연결이 부족합니다.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {reportKeywords.map(keyword => (
              <span
                key={keyword}
                className="rounded-full border border-white/[0.12] bg-white/[0.045] px-3 py-1 text-[11px] font-semibold text-zinc-300"
              >
                {keyword}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-2.5 text-[12px] font-semibold text-zinc-200">
                채용담당자가 기억할 모습
              </p>
              <ul className="space-y-2">
                {hiringMemoryItems.map(item => (
                  <li
                    key={item.text}
                    className="grid grid-cols-[18px_1fr] gap-2 text-[12.5px] leading-[1.55] text-zinc-300"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-px inline-flex size-[16px] items-center justify-center rounded-full border ${
                        item.mark === "✓"
                          ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                          : "border-amber-300/30 bg-amber-400/10 text-amber-200"
                      }`}
                    >
                      {item.mark === "✓" ? (
                        <Check className="size-2.5" />
                      ) : (
                        <AlertTriangle className="size-2.5" />
                      )}
                    </span>
                    <span className="pt-px">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-2.5 text-[12px] font-semibold text-zinc-200">
                현직자 코멘트
              </p>
              <div className="space-y-3">
                {mentorCommentPreviews.map((comment, index) => (
                  <blockquote key={comment.title} className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`text-[20px] font-extrabold leading-none tracking-[0.08em] opacity-60 ${comment.numberClassName}`}
                      >
                        0{index + 1}
                      </span>
                      <p className="text-[12.5px] font-bold text-zinc-100">
                        {comment.title}
                      </p>
                    </div>
                    <p className="text-[12px] leading-[1.7] text-zinc-400">
                      {comment.text}
                    </p>
                  </blockquote>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
