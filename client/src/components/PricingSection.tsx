import { ArrowRight, Check } from "lucide-react";
import { useLocation } from "wouter";
import { BrandName } from "@/components/BrandName";
import {
  COMPANY_REPORT_INCLUDED_FEATURES,
  PRICING,
  REPORT_INCLUDED_FEATURES,
  STANDARD_PER_USE_PRICE,
  TIERS,
  formatKrw,
} from "@/lib/pricing";

type TierKey = (typeof TIERS)[number]["key"];

// 티어별 소개 문구. 이용권 페이지(Entitlements TIER_COPY)와 같은 상황 구분을 쓴다.
// 베이직은 자소서·기업 중 하나를 고르는 상품이라 대표 가격(single)으로 보여주고, 선택은 이용권 페이지에서 한다.
const TIER_INTRO: Record<TierKey, { perUseNote: string; lead: string; body: string }> = {
  basic: {
    perUseNote: "자소서 진단 1회 또는 기업 분석 1회",
    lead: "한 번만 필요할 때.",
    body: "자소서 한 편을 제출 전에 점검받거나, 지원할 회사 한 곳을 자소서 쓰기 전에 조사해 보세요.",
  },
  standard: {
    perUseNote: "자소서 진단 2회 + 기업 분석 1회",
    lead: "한 회사를 제대로 준비할 때.",
    body: "기업 분석으로 채용 기준을 파악하고, 자소서 진단 2회로 초안부터 고쳐 쓴 뒤까지 다시 확인해 보세요.",
  },
  premium: {
    perUseNote: "자소서 진단 3회 + 기업 분석 3회",
    lead: "여러 회사에 함께 지원할 때.",
    body: "회사 세 곳을 조사하고, 회사마다 자소서 진단을 한 번씩 받아 보세요.",
  },
};

/* ─────────────────────────────────────────────────────────
   PricingSection — 랜딩 가격 안내
   리포트 쇼케이스 직후에 배치해 "방금 본 리포트가 이 가격"이라는
   대비를 만든다. 실제 구매·잔여 조회는 /entitlements 가 담당한다.
   ───────────────────────────────────────────────────────── */

// 세로 막대 비교: 사설 첨삭 시세(일반적 범위) 대비 회당 가격.
// 막대 높이(px)는 범위 상한 15만원을 176px로 둔 비율값이고,
// 최저 막대는 보이도록 8px로 클램프한다.
const COMPARISON_COLUMNS = [
  {
    label: "사설 첨삭 · 문항당",
    note: "첨삭 업체·프리랜서 플랫폼",
    value: "2~5만원",
    barHeight: 58,
    isPreview: false,
  },
  {
    label: "사설 첨삭 · 자소서 1건",
    note: "전 문항 첨삭·컨설팅",
    value: "5~15만원",
    barHeight: 176,
    isPreview: false,
  },
  {
    label: "회당",
    note: "스탠다드 기준",
    value: formatKrw(STANDARD_PER_USE_PRICE),
    barHeight: 8,
    isPreview: true,
  },
];

function TierCard({ tier }: { tier: (typeof TIERS)[number] }) {
  const [, navigate] = useLocation();
  // 베이직은 두 상품(자소서 1회 / 기업 1회)이 같은 가격이라 첫 상품을 대표로 보여준다.
  const plan = PRICING[tier.products[0]];
  const intro = TIER_INTRO[tier.key];
  const highlighted = tier.key === "standard";
  const totalUses = plan.uses + plan.companyUses;

  return (
    <div
      className={`plan-card flex h-full flex-col rounded-[28px] border-2 bg-surface px-8 py-9 ${
        highlighted ? "border-brand" : "border-surface"
      }`}
    >
      <h3
        className={`text-[17px] tracking-[-0.02em] ${
          highlighted ? "font-extrabold text-brand-ink" : "font-bold text-ink-2"
        }`}
      >
        {tier.label}
      </h3>
      <p className="mt-4 text-[34px] md:text-[36px] font-extrabold leading-none tracking-[-0.03em] text-ink">
        {formatKrw(plan.salePrice)}
        <span className="ml-1.5 text-base font-medium tracking-normal text-ink-4">
          / {totalUses}회
        </span>
      </p>
      {/* 묶음 상품은 할인액 대신 1회당 가격으로 — 많이 살수록 내려가는 게 보이게 */}
      {totalUses > 1 ? (
        <p className="mt-3 text-[15px] font-extrabold text-brand-ink">
          1회당 {formatKrw(Math.round(plan.salePrice / totalUses))}
        </p>
      ) : null}
      <p
        className="mt-1 text-[13px] text-ink-3"
      >
        {intro.perUseNote}
      </p>
      <p className="mt-4 border-t border-line-soft pt-4 text-[16px] font-bold leading-relaxed text-ink">
        {intro.lead}
      </p>
      <p className="mb-6 mt-2 flex-1 text-[15px] leading-[1.7] text-ink-3">
        {intro.body}
      </p>
      {/* 실제 결제·로그인 처리는 이용권 페이지에서 이어진다 */}
      <button
        type="button"
        onClick={() => navigate("/entitlements")}
        className={
          highlighted
            ? "h-12 w-full rounded-[10px] bg-brand text-[16px] font-bold text-white transition-colors hover:bg-brand-hover"
            : "h-12 w-full rounded-[10px] bg-brand-soft text-[16px] font-bold text-brand-ink transition-colors hover:bg-[#dbe9ff]"
        }
      >
        {tier.label} 구매하기
      </button>
    </div>
  );
}

export default function PricingSection() {
  const [, navigate] = useLocation();

  return (
    <section id="pricing" className="bg-fill py-24 md:py-[120px]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <div
          className="text-center mb-14"
        >
          <h2 className="text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink md:text-[46px]">
            합격에 가까워지는 비용,
            <br />
            <span className="text-brand">커피 한 잔</span>이면 충분합니다
          </h2>
          <p className="mt-4 mx-auto max-w-lg text-[16px] leading-[1.7] text-ink-3 md:text-[17px]">
            복잡한 구독 없이, 필요한 만큼만 담으세요.
          </p>
        </div>

        {/* 가격 카드 — 티어 순서는 pricing.ts TIERS 를 따른다 */}
        <div
          className="grid gap-5 md:grid-cols-3"
        >
          {TIERS.map(tier => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </div>

        {/* 리포트 구성 — 자소서·기업 두 리포트를 나란히. 이용권 페이지와 같은 문구 */}
        <div
          className="mt-5 max-w-5xl mx-auto grid gap-8 rounded-[28px] bg-surface px-7 py-8 md:grid-cols-2 md:gap-10 md:px-12 md:py-11"
        >
          <div>
            <p className="inline-flex h-[26px] items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">자소서 진단 리포트</p>
            <p className="mt-3 text-[18px] font-extrabold tracking-[-0.02em] text-ink">어떤 이용권을 선택하든, 이 모든 게 담깁니다</p>
            <ul className="mt-4 space-y-2.5">
              {REPORT_INCLUDED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[15px] text-ink-2">
                  <Check className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.6} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="inline-flex h-[26px] items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">기업 분석 리포트</p>
            <p className="mt-3 text-[18px] font-extrabold tracking-[-0.02em] text-ink">스탠다드·프리미엄에 포함, 베이직에서 따로 고를 수 있어요</p>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_REPORT_INCLUDED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-[15px] text-ink-2">
                  <Check className="h-4 w-4 shrink-0 text-brand" strokeWidth={2.6} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 무료 체험 안내 — 결제 전 부담을 없애는 문장이라 크게 둔다 */}
        <div
          className="mt-16 text-center md:mt-20"
        >
          <p className="text-[24px] font-extrabold tracking-[-0.03em] text-ink md:text-[30px]">
            가입하면 <span className="text-brand">첫 분석 1회는 무료</span>입니다
          </p>
          <p className="mt-3 text-[16px] text-ink-3">
            카드 등록 없이, 유료와 똑같은 리포트 전체를 받아볼 수 있어요.
          </p>
        </div>

        {/* 시세 비교 — 세로 막대로 가격 차이를 한눈에 보여준다 */}
        <div
          className="mx-auto mt-16 max-w-3xl rounded-[28px] bg-surface px-6 py-12 md:mt-20 md:rounded-[32px] md:px-12 md:py-[52px]"
        >
          <p className="text-center text-[20px] font-extrabold tracking-[-0.03em] text-ink md:text-[24px]">
            자소서 첨삭, 보통 얼마가 들까요?
          </p>

          <div className="mt-10 flex items-start justify-center gap-4 sm:gap-12">
            {COMPARISON_COLUMNS.map((column, index) => (
              <div
                key={column.label}
                className="flex w-[104px] sm:w-36 flex-col items-center"
              >
                {/* 막대 영역(고정 높이) — 값 라벨이 막대 바로 위에 붙는다 */}
                <div className="flex h-56 w-full flex-col items-center justify-end">
                  <p
                    className={`mb-2.5 whitespace-nowrap font-bold tracking-tight ${
                      column.isPreview
                        ? "text-[26px] font-extrabold text-brand-ink"
                        : "text-[18px] font-extrabold text-ink-3"
                    }`}
                  >
                    {column.value}
                  </p>
                  <div
                    className={`w-full shrink-0 origin-bottom rounded-t-[12px] ${
                      column.isPreview
                        ? "bg-brand"
                        : "bg-[#D1D6DB]"
                    }`}
                    style={{ height: column.barHeight }}
                  />
                </div>
                <div className="w-full border-t border-line pt-3 text-center">
                  <p
                    className={`whitespace-nowrap text-[12.5px] sm:text-[15px] leading-tight ${
                      column.isPreview
                        ? "font-bold text-ink"
                        : "font-bold text-ink-2"
                    }`}
                  >
                    {column.isPreview ? (
                      <>
                        <BrandName className="mr-1" variant="default" />
                        {column.label}
                      </>
                    ) : (
                      column.label
                    )}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[11px] sm:text-[13px] text-ink-4">
                    {column.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-[20px] font-extrabold tracking-[-0.03em] text-ink md:text-[24px]">
            ☕ 커피 한 잔 값으로, 자소서를 완성하세요
          </p>
          <p className="mt-2 text-center text-[13px] text-ink-4">
            * 사설 첨삭 비용은 일반적인 시세 범위로, 업체·범위에 따라 달라질 수
            있습니다.
          </p>
        </div>

        {/* CTA */}
        <div
          className="mt-16 text-center"
        >
          <button
            type="button"
            onClick={() => navigate("/entitlements")}
            className="landing-primary-cta group"
          >
            이용권 자세히 보기
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-3.5 text-[14px] text-ink-3">
            결제 전, 무료 분석으로 리포트를 먼저 경험해 보세요.
          </p>
        </div>
      </div>
    </section>
  );
}
