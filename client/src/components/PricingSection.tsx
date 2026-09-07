import { motion, type Variants } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useLocation } from "wouter";
import { BrandName } from "@/components/BrandName";
import {
  PRICING,
  REPORT_INCLUDED_FEATURES,
  SEASONAL_DISCOUNT_LABEL,
  TIERS,
  TRIPLE_PER_USE_PRICE,
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

const EASE = [0.21, 0.47, 0.32, 0.98] as const;

const revealVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

// 세로 막대 비교: 사설 첨삭 시세(일반적 범위) 대비 회당 가격.
// 막대 높이(px)는 범위 상한 150,000원을 176px로 둔 비율값이고,
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
    value: formatKrw(TRIPLE_PER_USE_PRICE),
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
  // 번들 상품(자소서+기업 크레딧을 함께 담은 상품)은 "따로 사면"으로, 단일 상품은 "정가"로 표기한다.
  const listPricePrefix = plan.uses + plan.companyUses > 1 && plan.companyUses > 0 ? "따로 사면" : "정가";

  return (
    <motion.div
      variants={revealVariants}
      className={`flex h-full flex-col rounded-2xl border bg-white/[0.02] p-8 backdrop-blur-sm transition-all duration-300 ${
        highlighted
          ? "border-blue-500/[0.25] hover:border-blue-400/[0.35]"
          : "border-white/[0.06] hover:border-white/[0.1]"
      }`}
    >
      <p
        className={`text-lg font-bold tracking-tight ${
          highlighted ? "text-blue-400" : "text-zinc-200"
        }`}
      >
        {tier.label}
      </p>
      <p className="mt-4 text-[2.6rem] md:text-[2.9rem] font-bold leading-none tracking-tight text-white">
        {formatKrw(plan.salePrice)}
        <span className="ml-1.5 text-base font-medium text-zinc-500">
          / {totalUses}회
        </span>
      </p>
      <p className="mt-3 text-base font-light text-zinc-400 line-through decoration-zinc-300/60 decoration-[1.5px]">
        {listPricePrefix} {formatKrw(plan.listPrice)}
      </p>
      <p className="mt-0.5 text-lg md:text-xl font-extrabold tracking-tight text-sky-300">
        {plan.discountLabel}
      </p>
      <p
        className={`mt-1 text-xs font-light ${
          highlighted ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {intro.perUseNote}
      </p>
      <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">
        {intro.lead}
      </p>
      <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
        {intro.body}
      </p>
      {/* 실제 결제·로그인 처리는 이용권 페이지에서 이어진다 */}
      <button
        type="button"
        onClick={() => navigate("/entitlements")}
        className={
          highlighted
            ? "h-11 w-full rounded-xl bg-gradient-to-r from-blue-500 to-cyan-400 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-400 hover:to-cyan-300"
            : "h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.05] text-sm font-semibold text-zinc-200 transition-colors hover:bg-white/[0.1]"
        }
      >
        {tier.label} 구매하기
      </button>
    </motion.div>
  );
}

export default function PricingSection() {
  const [, navigate] = useLocation();

  return (
    <section id="pricing" className="py-28 md:py-36 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="seasonal-discount-label mx-auto w-fit text-lg md:text-xl font-bold">
            {SEASONAL_DISCOUNT_LABEL}
          </p>
          <h2 className="mt-5 text-3xl md:text-4xl font-bold tracking-tight leading-snug">
            합격에 가까워지는 비용,
            <br />
            <span className="text-sky-300">커피 한 잔</span>이면 충분합니다
          </h2>
          <p className="mt-4 text-gray-500 font-light text-[15px] leading-[1.8] max-w-lg mx-auto">
            복잡한 구독 없이, 필요한 만큼만 담으세요.
          </p>
        </motion.div>

        {/* 가격 카드 — 티어 순서는 pricing.ts TIERS 를 따른다 */}
        <motion.div
          className="grid gap-6 md:grid-cols-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          {TIERS.map(tier => (
            <TierCard key={tier.key} tier={tier} />
          ))}
        </motion.div>

        {/* 리포트 공통 구성 — 어떤 이용권이든 같은 리포트 전체를 받는다 */}
        <motion.div
          className="mt-10 max-w-3xl mx-auto rounded-2xl border border-white/[0.06] bg-white/[0.015] px-7 py-6"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="text-[14px] font-semibold text-zinc-200">
            어떤 이용권을 선택하든, 리포트에는 이 모든 게 담깁니다
          </p>
          <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {REPORT_INCLUDED_FEATURES.map(feature => (
              <li
                key={feature}
                className="flex items-center gap-2.5 text-[13.5px] font-light text-zinc-400"
              >
                <Check className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                {feature}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* 무료 체험 안내 — 결제 전 부담을 없애는 문장이라 크게 둔다 */}
        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="text-2xl md:text-[1.75rem] font-bold tracking-tight text-white">
            가입하면 <span className="text-sky-300">첫 분석 1회는 무료</span>입니다
          </p>
          <p className="mt-2.5 text-[15px] font-light text-zinc-400">
            카드 등록 없이, 유료와 똑같은 리포트 전체를 받아볼 수 있어요.
          </p>
        </motion.div>

        {/* 시세 비교 — 세로 막대로 가격 차이를 한눈에 보여준다 */}
        <motion.div
          className="mt-20 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="text-center text-xl md:text-2xl font-bold tracking-tight text-white">
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
                        ? "text-2xl text-sky-300"
                        : "text-[17px] text-zinc-300"
                    }`}
                  >
                    {column.value}
                  </p>
                  <motion.div
                    className={`w-full shrink-0 origin-bottom rounded-t-lg ${
                      column.isPreview
                        ? "bg-gradient-to-t from-blue-500 to-cyan-400 shadow-[0_0_24px_rgba(59,130,246,0.45)]"
                        : "bg-gradient-to-t from-zinc-500/[0.28] to-zinc-500/[0.1]"
                    }`}
                    style={{ height: column.barHeight }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    transition={{ duration: 0.8, delay: 0.15 * index, ease: EASE }}
                    viewport={{ once: true, margin: "-80px" }}
                  />
                </div>
                <div className="mt-3.5 text-center">
                  <p
                    className={`whitespace-nowrap text-[12.5px] sm:text-[15px] leading-tight ${
                      column.isPreview
                        ? "font-semibold text-white"
                        : "font-normal text-zinc-400"
                    }`}
                  >
                    {column.isPreview ? (
                      <>
                        <BrandName className="mr-1" />
                        {column.label}
                      </>
                    ) : (
                      column.label
                    )}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[11px] sm:text-[12.5px] font-light text-zinc-500">
                    {column.note}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-10 text-center text-xl md:text-2xl font-semibold tracking-tight text-white">
            ☕ 커피 한 잔 값으로, 자소서를 완성하세요
          </p>
          <p className="mt-6 text-center text-[12.5px] font-light text-zinc-500">
            * 사설 첨삭 비용은 일반적인 시세 범위로, 업체·범위에 따라 달라질 수
            있습니다.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-16 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <button
            type="button"
            onClick={() => navigate("/entitlements")}
            className="landing-primary-cta group"
          >
            이용권 자세히 보기
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <p className="mt-4 text-[12.5px] font-light text-zinc-500">
            결제 전, 무료 분석으로 리포트를 먼저 경험해 보세요.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
