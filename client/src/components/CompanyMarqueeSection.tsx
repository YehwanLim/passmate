import { type CSSProperties } from "react";
import { SUCCESSFUL_COMPANIES } from "@/constants/socialProof";

/* ─────────────────────────────────────────────────────────
   CompanyMarqueeSection — 기업 로고 마퀴 (분석 지원 프레임)
   합격 실적이 아니라 "이런 기업의 자소서를 분석할 수 있다"로만
   제시한다. 실후기 확보 전까지 합격을 암시하는 문구를 쓰지 않는다.
   ───────────────────────────────────────────────────────── */

const marqueeCompanyGroups = [SUCCESSFUL_COMPANIES, SUCCESSFUL_COMPANIES];

export default function CompanyMarqueeSection() {
  return (
    <section
      className="overflow-hidden py-10 md:py-14"
      aria-labelledby="company-marquee-title"
    >
      <p
        id="company-marquee-title"
        className="mb-8 px-6 text-center text-[13px] font-light text-zinc-500"
      >
        이런 기업의 자소서를, 그 회사의 기준으로 분석합니다
      </p>

      <div
        className="social-proof-marquee border-y border-white/[0.06] py-6"
        aria-label="분석 지원 기업 목록"
      >
        <div className="social-proof-marquee-track" aria-hidden="true">
          {marqueeCompanyGroups.map((companies, groupIndex) => (
            <div className="social-proof-marquee-group" key={groupIndex}>
              {companies.map(company => (
                <div key={company.id} className="social-proof-logo-shell">
                  <img
                    src={company.logoSrc}
                    alt=""
                    aria-hidden="true"
                    className="social-proof-logo"
                    style={
                      { "--logo-scale": company.logoScale } as CSSProperties
                    }
                    width={168}
                    height={48}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
        <ul className="sr-only">
          {SUCCESSFUL_COMPANIES.map(company => (
            <li key={company.id}>{company.name}</li>
          ))}
        </ul>
      </div>

      <p className="mt-4 px-6 text-center text-[11px] text-zinc-500">
        각 로고는 해당 기업의 상표이며, Pre:View와의 제휴·보증 관계를 의미하지
        않습니다.
      </p>
    </section>
  );
}
