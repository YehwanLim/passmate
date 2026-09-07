import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

import { COMPANY_REPORT_SAMPLE_COMPANY } from "@/constants/companyReportSampleMeta";
import { PRICING, formatKrw } from "@/lib/pricing";
import { COMPANY_REPORT_NAV_SECTIONS } from "@/pages/companyReportNavigation";

/* ─────────────────────────────────────────────────────────
   CompanyReportIntroSection — 랜딩 기업 분석 리포트 소개
   자소서 리포트 쇼케이스 다음, 가격 앞에 둔다. 자소서를 쓰기 전 단계의
   상품이라 "회사부터 읽는다"는 순서를 문장으로 만들고, 오른쪽에는
   실제 리포트 목차(companyReportNavigation)를 그대로 보여 준다 — 과장 금지.
   ───────────────────────────────────────────────────────── */

export const COMPANY_REPORT_INTRO_ID = "company-report-intro";

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

export default function CompanyReportIntroSection() {
  const [, navigate] = useLocation();

  return (
    <section
      id={COMPANY_REPORT_INTRO_ID}
      className="py-28 md:py-36 border-t border-white/[0.04]"
    >
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <motion.div
          className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:items-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          {/* 설명 */}
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-sky-300">
              Company Brief
            </p>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight leading-snug text-balance">
              자소서를 쓰기 전에,
              <br />
              <span className="text-sky-300">회사부터</span> 읽습니다
            </h2>
            <p className="mt-5 text-gray-400 font-light text-[15px] leading-[1.8] max-w-lg text-pretty">
              무엇을 팔아 돈을 버는지, 요즘 힘을 싣는 사업이 무엇인지, 그 안에서
              지원 직무가 어떤 문제를 푸는지. 공개 자료를 출처와 함께 정리해
              자소서에 쓸 사업 소재까지 이어 드려요.
            </p>
            <p className="mt-5 text-[13.5px] text-zinc-500">
              기업 분석 1회 {formatKrw(PRICING.company.salePrice)}
              <span className="mx-2 text-zinc-700">·</span>
              스탠다드·프리미엄 이용권에 포함
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate("/company-analysis")}
                className="landing-primary-cta group"
              >
                <span className="relative z-10">기업 분석 시작하기</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/company-report?sample=1")}
                className="h-11 rounded-xl border border-white/[0.12] bg-white/[0.05] px-5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
              >
                샘플 리포트 보기 · {COMPANY_REPORT_SAMPLE_COMPANY}
              </button>
              {/* 이용권 페이지는 #company 로 베이직 카드의 기업 분석 선택을 켠 채 연다 */}
              <button
                type="button"
                onClick={() => navigate("/entitlements#company")}
                className="h-11 rounded-xl border border-white/[0.12] bg-white/[0.05] px-5 text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
              >
                이용권 보기
              </button>
            </div>
          </div>

          {/* 리포트 목차 — 실제 리포트 섹션 순서 그대로 */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-7 backdrop-blur-sm">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-sky-300">
              리포트 목차
            </p>
            <ol className="mt-4 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {COMPANY_REPORT_NAV_SECTIONS.map(section => (
                <li
                  key={section.id}
                  className="flex items-baseline gap-2.5 text-[14px] text-zinc-200"
                >
                  <span className="w-5 shrink-0 font-mono text-[11px] tracking-wider text-zinc-500">
                    {section.indexLabel}
                  </span>
                  {section.label}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[12.5px] font-light leading-relaxed text-zinc-500">
              공개 자료를 바탕으로 정리한 브리프예요. 수치는 부록의 출처
              원문에서 확인할 수 있어요.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
