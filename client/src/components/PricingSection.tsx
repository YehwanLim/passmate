import { motion } from "framer-motion";
import { ArrowRight, Check, Gift, Ticket } from "lucide-react";
import { useLocation } from "wouter";

const includedItems = [
  "첫 분석 1회 무료",
  "첫 분석부터 전체 리포트 제공",
  "추가 분석은 2회권으로 이용",
  "수정본 재분석 또는 다른 지원서 분석 가능",
];

export default function PricingSection() {
  const [, navigate] = useLocation();

  return (
    <section className="relative py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(139,92,246,0.05) 0%, rgba(59,130,246,0.03) 40%, transparent 70%)",
        }}
      />

      <div className="relative max-w-4xl mx-auto px-6 lg:px-10">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-5">
            <span className="w-4 h-px bg-gray-700" />
            이용권
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            처음 1회는 무료로 시작하세요
          </h2>
          <p className="text-gray-500 font-light text-[15px] leading-[1.8] max-w-lg mx-auto">
            더 다듬고 싶은 지원서가 생기면 2회권으로 이어서 분석할 수 있습니다.
          </p>
        </motion.div>

        <motion.div
          className="relative max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] }}
          viewport={{ once: true, margin: "-60px" }}
        >
          <div className="absolute -inset-px rounded-[22px] bg-gradient-to-br from-blue-500/35 via-purple-500/25 to-emerald-500/15 blur-[1px] pointer-events-none" />

          <div className="relative rounded-[22px] bg-[#0A0A0A] border border-white/[0.12] p-7 md:p-9 backdrop-blur-sm">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:items-stretch">
              <div className="flex flex-col justify-between gap-7">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/[0.09] border border-emerald-500/[0.14] flex items-center justify-center mb-5">
                    <Gift className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-400 tracking-widest uppercase mb-3">
                    First Analysis
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight mb-3">
                    첫 분석 1회 무료
                  </h3>
                  <p className="text-[14px] text-gray-500 font-light leading-[1.8]">
                    가입 후 첫 자소서는 비용 없이 전체 리포트를 확인할 수 있어요.
                  </p>
                </div>

                <button
                  className="group w-full md:w-fit flex items-center justify-center gap-2 h-12 px-5 rounded-xl bg-white text-[#000] text-[14px] font-medium transition-all duration-300 hover:bg-gray-100 active:scale-[0.98]"
                  onClick={() => navigate("/analyze")}
                >
                  무료 분석 시작하기
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                </button>
              </div>

              <div className="hidden md:block bg-white/[0.08]" />

              <div className="flex flex-col justify-between gap-7">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/[0.1] border border-purple-500/[0.16] flex items-center justify-center mb-5">
                    <Ticket className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-[11px] font-semibold text-purple-400 tracking-widest uppercase mb-3">
                    Additional Credits
                  </p>
                  <div className="flex items-baseline gap-2 mb-3">
                    <span className="text-4xl font-bold tracking-tight">
                      ₩9,900
                    </span>
                    <span className="text-[13px] text-gray-500 font-light">
                      / 2회권
                    </span>
                  </div>
                  <p className="text-[14px] text-gray-500 font-light leading-[1.8]">
                    추가 분석은 2회권으로 이용하고, 수정본이나 다른 지원서에 자유롭게 사용할 수 있습니다.
                  </p>
                </div>

                <ul className="space-y-3">
                  {includedItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-[14px] text-gray-400 font-light"
                    >
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
