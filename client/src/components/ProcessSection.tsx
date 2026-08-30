import { motion, type Variants } from "framer-motion";
import {
  ClipboardPaste,
  Building2,
  FileBarChart,
  ArrowRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   ProcessSection — 3-Step "How to Use" vertical timeline
   ───────────────────────────────────────────────────────── */

const steps = [
  {
    num: "01",
    title: "자소서 붙여넣기",
    description:
      "이미 써둔 자소서 문항을 그대로 붙여넣습니다. 문항은 최대 5개까지 한 번에 볼 수 있습니다.",
    icon: ClipboardPaste,
    color: "#3B82F6",
    glowColor: "rgba(59,130,246,0.12)",
  },
  {
    num: "02",
    title: "지원 기업·직무 입력",
    description:
      "어느 회사, 어떤 직무에 내는 자소서인지 알려주세요. 리포트는 그 기준으로 읽습니다.",
    icon: Building2,
    color: "#8B5CF6",
    glowColor: "rgba(139,92,246,0.12)",
  },
  {
    num: "03",
    title: "리포트 확인",
    description:
      "1분 안에 첫인상부터 문장 피드백, 예상 질문까지 담긴 리포트가 도착합니다.",
    icon: FileBarChart,
    color: "#10B981",
    glowColor: "rgba(16,185,129,0.12)",
  },
];

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] },
  },
};

export default function ProcessSection() {
  return (
    <section className="py-28 md:py-36 border-t border-white/[0.04]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          viewport={{ once: true, margin: "-80px" }}
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            리포트까지, 3단계면 충분합니다
          </h2>
          <p className="text-gray-500 font-light text-[15px] leading-[1.8] max-w-lg mx-auto">
            붙여넣고, 회사를 알려주고, 1분 기다리면 됩니다. 예약도 견적도 필요
            없습니다.
          </p>
        </motion.div>

        {/* Timeline */}
        <motion.div
          className="relative max-w-3xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
        >
          {/* Vertical connecting line */}
          <div className="absolute left-[27px] md:left-[31px] top-8 bottom-8 w-px bg-gradient-to-b from-blue-500/20 via-purple-500/20 to-emerald-500/20" />

          {steps.map(
            ({ num, title, description, icon: Icon, color, glowColor }, i) => (
              <motion.div
                key={num}
                variants={itemVariants}
                className="relative pl-20 md:pl-24 pb-14 last:pb-0"
              >
                {/* Node circle */}
                <div
                  className="absolute left-0 w-[56px] h-[56px] md:w-[64px] md:h-[64px] rounded-2xl flex items-center justify-center border backdrop-blur-sm z-10"
                  style={{
                    borderColor: `${color}30`,
                    backgroundColor: `${color}08`,
                    boxShadow: `0 0 24px ${glowColor}`,
                  }}
                >
                  <Icon className="w-6 h-6 md:w-7 md:h-7" style={{ color }} />
                </div>

                {/* Card */}
                <div className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl p-7 backdrop-blur-sm hover:border-white/[0.12] transition-all duration-500">
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
                    }}
                  />

                  <div className="relative">
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className="text-[11px] font-bold tracking-[0.2em] uppercase"
                        style={{ color }}
                      >
                        Step {num}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-[22px] font-semibold tracking-[-0.01em] mb-2.5">
                      {title}
                    </h3>
                    <p className="text-[14px] text-gray-500 font-light leading-[1.8]">
                      {description}
                    </p>
                  </div>
                </div>

                {/* Connector arrow between steps */}
                {i < steps.length - 1 && (
                  <div className="absolute left-[27px] md:left-[31px] -bottom-1 z-10">
                    <ArrowRight className="w-3 h-3 text-gray-700 rotate-90" />
                  </div>
                )}
              </motion.div>
            )
          )}
        </motion.div>
      </div>
    </section>
  );
}
