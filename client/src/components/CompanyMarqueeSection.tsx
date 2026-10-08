import { type CSSProperties } from "react";
import OpenJobsStrip from "@/components/OpenJobsStrip";
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
      className="overflow-hidden bg-fill-soft px-6 py-20 md:py-24 lg:px-10"
      aria-labelledby="company-marquee-title"
    >
      <p
        id="company-marquee-title"
        className="mb-6 text-center text-[16px] font-bold text-ink-2 md:text-[17px]"
      >
        이런 기업의 자소서를, 그 회사의 기준으로 분석합니다
      </p>

      <div
        className="social-proof-marquee mx-auto max-w-7xl rounded-[28px] bg-surface py-8"
        aria-label="분석 지원 기업 목록"
      >
        {/* 첫 그룹의 로고만 alt(회사명)를 가진다. 두 번째 그룹은 끊김 없는 마퀴를 위한 복제라 장식으로 둔다. */}
        <div className="social-proof-marquee-track">
          {marqueeCompanyGroups.map((companies, groupIndex) => (
            <div
              className="social-proof-marquee-group"
              key={groupIndex}
              aria-hidden={groupIndex > 0 || undefined}
            >
              {companies.map(company => (
                <div key={company.id} className="social-proof-logo-shell">
                  <img
                    src={company.logoSrc}
                    alt={groupIndex === 0 ? company.logoAlt : ""}
                    // 첫 화면 아래라 지연 로드. 프리렌더 시 React 가 <link rel=preload> 를 17개 넣어
                    // 히어로 CSS·JS 와 대역폭을 다투는 것도 막는다.
                    loading="lazy"
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
      </div>

      {/* 로고(이런 회사 자소서를 본다) 바로 밑에 그중 지금 뽑는 곳(10-09). 접수 중 공고가 없으면 그리지 않는다. */}
      <OpenJobsStrip />

      <p className="mt-6 text-center text-[12px] text-ink-3">
        각 로고는 해당 기업의 상표이며, Pre:View와의 제휴·보증 관계를 의미하지
        않습니다.
      </p>
    </section>
  );
}
