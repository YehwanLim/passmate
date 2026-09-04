import { motion, type Variants } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useLocation } from "wouter";
import { BrandName } from "@/components/BrandName";
import {
  PRICING,
  REPORT_INCLUDED_FEATURES,
  SEASONAL_DISCOUNT_LABEL,
  TRIPLE_PER_USE_PRICE,
  formatKrw,
} from "@/lib/pricing";

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
    note: "3회권 기준",
    value: formatKrw(TRIPLE_PER_USE_PRICE),
    barHeight: 8,
    isPreview: true,
  },
];

function PaidPlanCard({
  planKey,
  perUseNote,
  lead,
  body,
}: {
  planKey: "single" | "triple";
  perUseNote: string;
  lead: string;
  body: string;
}) {
  const [, navigate] = useLocation();
  const plan = PRICING[planKey];
  const highlighted = planKey === "triple";

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
        {plan.label}
      </p>
      <p className="mt-4 text-[2.6rem] md:text-[2.9rem] font-bold leading-none tracking-tight text-white">
        {formatKrw(plan.salePrice)}
        <span className="ml-1.5 text-base font-medium text-zinc-500">
          / {plan.uses}회
        </span>
      </p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-base">
        <span className="font-light text-zinc-400 line-through decoration-zinc-300/60 decoration-[1.5px]">
          정가 {formatKrw(plan.listPrice)}
        </span>
        <span className="text-lg md:text-xl font-extrabold tracking-tight text-sky-300">
          {plan.discountLabel}
        </span>
      </p>
      <p
        className={`mt-1 text-xs font-light ${
          highlighted ? "text-zinc-300" : "text-zinc-500"
        }`}
      >
        {perUseNote}
      </p>
      <p className="mt-6 text-[14.5px] font-medium leading-relaxed text-zinc-200">
        {lead}
      </p>
      <p className="mb-7 mt-2 flex-1 text-[13px] font-light leading-[1.8] text-zinc-500">
        {body}
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
        {plan.label} 구매하기
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
          <p className="text-lg md:text-xl font-bold tracking-[0.04em] text-sky-300">
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

        {/* 가격 카드 */}
        <motion.div
          className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <PaidPlanCard
            planKey="single"
            perUseNote="이번 지원, 제출 전 마지막 점검"
            lead="당장 앞둔 마감 하나에 집중하고 싶다면."
            body="지금 쓴 자소서가 채용 담당자에게 어떻게 읽히는지, 제출 전에 확인해 보세요."
          />
          <PaidPlanCard
            planKey="triple"
            perUseNote={`회당 ${formatKrw(TRIPLE_PER_USE_PRICE)} — 커피 한 잔 값`}
            lead="고쳐 쓰고, 다시 확인하고, 다음 지원까지."
            body="지원하는 회사가 바뀌면 리포트의 기준도 바뀝니다. 고쳐 쓴 자소서가 정말 나아졌는지도 다시 확인해 보세요."
          />
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
