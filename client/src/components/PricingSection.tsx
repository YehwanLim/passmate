import { motion } from "framer-motion";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

/* ─────────────────────────────────────────────────────────
   PricingSection — Starter vs Pro Pass cards
   ───────────────────────────────────────────────────────── */

const plans = [
  {
    id: "starter",
    name: "Starter",
    badge: "무료 진단",
    purpose: "내 자소서의 객관적 위치 파악",
    benefit: "가입 즉시 기본 분석 1회 무료",
    price: "₩0",
    priceLabel: "무료",
    features: [
      "종합 점수",
      "논리 구조 진단",
      "모호한 표현 팩트 체크",
    ],
    cta: "무료로 시작하기",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro Pass",
    badge: "프리미엄 패키지",
    purpose: "타겟 직무 완벽 매칭 및 실전 면접 방어",
    benefit: "서류 시즌 대비 3회권 / 5회권",
    price: "₩9,900",
    priceLabel: "/ 1회",
    features: [
      "Starter 전 기능 포함",
      "JD 맞춤형 딥다이브",
      "킬러 소재 발굴",
      "실전 면접 방어 시나리오 제공",
    ],
    cta: "Pro Pass 시작하기",
    highlighted: true,
  },
];

export default function PricingSection() {
  const [, navigate] = useLocation();

  return (
    <section className="relative py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
      {/* Background aura */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(139,92,246,0.05) 0%, rgba(59,130,246,0.03) 40%, transparent 70%)",
        }}
      />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-5">
            <span className="w-4 h-px bg-gray-700" />
            요금제
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            당신에게 맞는 플랜을 선택하세요
          </h2>
          <p className="text-gray-500 font-light text-[15px] leading-[1.8] max-w-lg mx-auto">
            무료 체험으로 시작하고, 필요할 때 프리미엄으로 업그레이드하세요.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto items-stretch">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              className="relative"
              initial={{ opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                delay: i * 0.12,
                ease: [0.21, 0.47, 0.32, 0.98],
              }}
              viewport={{ once: true, margin: "-60px" }}
              style={plan.highlighted ? { transform: "scale(1.02)" } : {}}
            >
              {/* Gradient glow border for Pro */}
              {plan.highlighted && (
                <div className="absolute -inset-px rounded-[20px] bg-gradient-to-br from-blue-500/40 via-purple-500/30 to-blue-500/20 blur-[1px] pointer-events-none" />
              )}

              <div
                className={`relative h-full rounded-[20px] p-8 md:p-10 backdrop-blur-sm flex flex-col ${
                  plan.highlighted
                    ? "bg-[#0A0A0A] border border-white/[0.12]"
                    : "bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1]"
                } transition-all duration-500`}
              >
                {/* Popular badge */}
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full text-[11px] font-semibold text-white tracking-wide shadow-lg shadow-purple-500/20">
                      <Sparkles className="w-3 h-3" />
                      추천
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="mb-8">
                  <div className="flex items-center gap-2.5 mb-4 mt-1">
                    <h3 className="text-xl font-bold tracking-tight">
                      {plan.name}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${
                        plan.highlighted
                          ? "bg-purple-500/[0.12] text-purple-400 border border-purple-500/[0.15]"
                          : "bg-white/[0.04] text-gray-500 border border-white/[0.06]"
                      }`}
                    >
                      {plan.badge}
                    </span>
                  </div>

                  <p className="text-[13px] text-gray-500 font-light leading-[1.7] mb-5">
                    {plan.purpose}
                  </p>

                  {/* Price */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight">
                      {plan.price}
                    </span>
                    <span className="text-[13px] text-gray-600 font-light">
                      {plan.priceLabel}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-600 mt-2 font-light">
                    {plan.benefit}
                  </p>
                </div>

                {/* Feature list */}
                <div className="flex-1 mb-8">
                  <p className="text-[11px] font-medium text-gray-600 uppercase tracking-widest mb-4">
                    포함 기능
                  </p>
                  <ul className="space-y-3">
                    {plan.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2.5 text-[14px] text-gray-400 font-light"
                      >
                        <Check
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            plan.highlighted
                              ? "text-purple-400"
                              : "text-gray-600"
                          }`}
                        />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <button
                  className={`group w-full flex items-center justify-center gap-2 h-12 rounded-xl text-[14px] font-medium transition-all duration-300 active:scale-[0.98] ${
                    plan.highlighted
                      ? "bg-white text-[#000] hover:shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:bg-gray-100"
                      : "bg-white/[0.05] text-white border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15]"
                  }`}
                  onClick={() => navigate("/analyze")}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
