import { ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

import { COMPANY_REPORT_NAV_SECTIONS } from "@/pages/companyReportNavigation";

/* ─────────────────────────────────────────────────────────
   CompanyReportIntroSection — 랜딩 기업 분석 리포트 소개
   자소서 리포트 쇼케이스 다음, 가격 앞에 둔다. 자소서를 쓰기 전 단계의
   상품이라 "회사부터 읽는다"는 순서를 문장으로 만들고, 오른쪽에는
   실제 리포트 목차(companyReportNavigation)를 그대로 보여 준다 — 과장 금지.
   ───────────────────────────────────────────────────────── */

export const COMPANY_REPORT_INTRO_ID = "company-report-intro";

export default function CompanyReportIntroSection() {
  const [, navigate] = useLocation();

  return (
    <section
      id={COMPANY_REPORT_INTRO_ID}
      className="bg-fill-soft py-24 md:py-[120px]"
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-stretch">
          {/* 설명 */}
          <div className="flex flex-col justify-center rounded-[28px] bg-surface p-8 md:rounded-[32px] md:p-[52px]">
            <span className="inline-flex h-7 w-fit items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">
              Company Brief
            </span>
            <h2 className="mt-[18px] text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink text-balance md:text-[44px]">
              자소서를 쓰기 전에,
              <br />
              <span className="text-brand">회사부터</span> 분석해보세요.
            </h2>
            <p className="mt-[18px] max-w-lg text-pretty text-[16px] leading-[1.75] text-ink-3 md:text-[17px]">
              무엇을 팔아 돈을 버는지, 요즘 힘을 주고 있는 사업은 무엇인지, 각
              직무별 마주한 주요 문제는 무엇인지. 회사에 대한 기초 지식과 심화
              정보까지 한 눈에 알아보고, 자소서에 쓸 소재까지 함께
              정리해드립니다.
            </p>
            {/* 가격은 아래 가격 섹션이 맡는다. 두 버튼은 좌우로 나란히 두고, 라벨은 한 줄로 고정한다.
                보조 버튼은 주 CTA 와 높이·모서리를 맞춘다. */}
            <div className="mt-[26px] flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => navigate("/company-analysis")}
                className="landing-primary-cta group whitespace-nowrap"
              >
                <span className="relative z-10">기업 분석 시작하기</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/company-report?sample=1")}
                className="landing-secondary-cta whitespace-nowrap"
              >
                샘플 리포트 보기
              </button>
            </div>
          </div>

          {/* 리포트 목차 — 실제 리포트 섹션 순서 그대로 */}
          <div className="flex flex-col gap-5 rounded-[28px] bg-surface p-8 md:rounded-[32px] md:p-11">
            <span className="inline-flex h-7 w-fit items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">
              리포트 목차
            </span>
            <ol className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
              {COMPANY_REPORT_NAV_SECTIONS.map(section => (
                <li
                  key={section.id}
                  className="flex h-12 items-center gap-2.5 rounded-[14px] bg-fill-soft px-4 text-[15px] font-semibold text-ink"
                >
                  <span className="w-5 shrink-0 font-mono text-[13px] font-semibold text-brand-ink">
                    {section.indexLabel}
                  </span>
                  {section.label}
                </li>
              ))}
            </ol>
            <p className="text-[13px] leading-[1.6] text-ink-4">
              공개된 자료를 바탕으로 정리된 리포트입니다. 각 내용의 출처는
              리포트의 부록에서 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
