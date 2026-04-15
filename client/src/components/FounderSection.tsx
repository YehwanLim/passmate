import { useState } from "react";
import { motion } from "framer-motion";
import { User, Sparkles, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

/* ─────────────────────────────────────────────────────────
   FounderSection — Founder Profile + CTA + Footer
   ───────────────────────────────────────────────────────── */

const founderTags = [
  "삼성전자 현직 PM",
  "현대자동차 합격 경험",
  "100회+ 실무 멘토링 진행",
  "AI 서비스 기획 노하우 적용",
];

export default function FounderSection() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setEmailSubmitted(true);
      setTimeout(() => {
        setEmail("");
        setEmailSubmitted(false);
      }, 3000);
    }
  };

  return (
    <>
      {/* ══════════════════════════════════════════════════
          Founder Profile
          ══════════════════════════════════════════════════ */}
      <section className="py-28 md:py-36 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="grid md:grid-cols-5 gap-12 md:gap-16 items-center">
              {/* Avatar Card */}
              <div className="md:col-span-2 flex justify-center">
                <div className="relative group">
                  {/* Subtle glow behind card */}
                  <div
                    className="absolute -inset-6 rounded-3xl blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-700"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, rgba(59,130,246,0.08) 0%, transparent 70%)",
                    }}
                  />

                  <div className="relative w-56 h-64 md:w-64 md:h-72 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center backdrop-blur-sm group-hover:border-white/[0.1] transition-all duration-500">
                    <div className="w-20 h-20 bg-white/[0.04] rounded-full flex items-center justify-center mb-4 group-hover:bg-white/[0.06] transition-colors duration-300">
                      <User className="w-10 h-10 text-gray-600" />
                    </div>
                    <span className="text-[11px] text-gray-600 font-medium tracking-[0.2em] uppercase">
                      파운더
                    </span>
                  </div>
                </div>
              </div>

              {/* Text Content */}
              <div className="md:col-span-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-6">
                  <span className="w-4 h-px bg-gray-700" />
                  소개
                </span>
                <h2 className="text-2xl md:text-3xl font-bold leading-snug tracking-tight mb-5">
                  현직 대기업 PM이 직접 설계한
                  <br />
                  &lsquo;진짜&rsquo; 취준 시스템
                </h2>
                <p className="text-gray-500 font-light text-[15px] leading-[1.9] mb-8">
                  블로그를 통한 100회 이상의 커피챗과 멘토링을 진행하며
                  깨달았습니다. 합격하는 자소서에는 명확한
                  &lsquo;로직&rsquo;이 있습니다. AI 서비스 기획 전문가의
                  노하우를 담아 그 로직을 시스템에 그대로 이식했습니다.
                </p>

                {/* Tags */}
                <div className="flex flex-wrap gap-2.5">
                  {founderTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-full text-[12px] font-medium text-gray-400 hover:border-white/[0.14] hover:text-gray-300 transition-all duration-300 cursor-default"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CTA
          ══════════════════════════════════════════════════ */}
      <section className="relative py-28 md:py-36 border-t border-white/[0.04] overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(59,130,246,0.06) 0%, rgba(139,92,246,0.03) 35%, transparent 65%)",
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center px-6 lg:px-10">
          <motion.h2
            className="text-3xl md:text-4xl font-bold tracking-tight mb-5"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
            viewport={{ once: true, margin: "-80px" }}
          >
            지금 바로 자소서를 분석해보세요
          </motion.h2>
          <motion.p
            className="text-gray-500 font-light text-[15px] leading-[1.8] mb-10 max-w-md mx-auto"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.1,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            viewport={{ once: true, margin: "-80px" }}
          >
            무료로 당신의 자소서를 분석받고 합격 가능성을 높이세요.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              delay: 0.2,
              ease: [0.21, 0.47, 0.32, 0.98],
            }}
            viewport={{ once: true, margin: "-80px" }}
          >
            <button
              className="group inline-flex items-center gap-2 bg-white text-[#000] h-12 px-7 rounded-[10px] text-[14px] font-medium transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] hover:bg-gray-100 active:scale-[0.98]"
              onClick={() => navigate("/analyze")}
            >
              무료 체험하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          Footer
          ══════════════════════════════════════════════════ */}
      <section className="py-16 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-6 lg:px-10">
          {/* Newsletter */}
          <div className="text-center mb-8">
            <h3 className="text-xl font-semibold mb-2">
              새로운 기능 소식을 가장 먼저 받아보세요
            </h3>
            <p className="text-[14px] text-gray-500 font-light">
              AI 모의 면접, 합격 OS 템플릿 등 곧 출시될 기능의 얼리버드
              알림을 받아보세요.
            </p>
          </div>

          <form
            onSubmit={handleEmailSubmit}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일 주소를 입력해주세요"
              required
              className="flex-1 h-11 px-4 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-[14px] text-white placeholder:text-gray-600"
            />
            <button
              type="submit"
              className="bg-white text-[#000] h-11 px-6 text-[13px] font-semibold rounded-xl hover:bg-gray-200 transition-colors duration-200"
            >
              {emailSubmitted ? "완료" : "알림 신청"}
            </button>
          </form>

          {emailSubmitted && (
            <motion.p
              className="text-center text-[13px] text-emerald-400 font-medium mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              감사합니다! 곧 이메일로 소식을 전해드리겠습니다.
            </motion.p>
          )}

          {/* Bottom bar */}
          <div className="text-center pt-8 border-t border-white/[0.04]">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-gray-700" />
              <span className="text-[13px] font-medium text-gray-700 tracking-tight">
                PassMate
              </span>
            </div>
            <p className="text-[12px] text-gray-700">
              &copy; 2026 PassMate. All rights reserved.{" "}
              <a
                href="#"
                className="text-gray-500 hover:text-white transition-colors ml-1"
              >
                개인정보처리방침
              </a>{" "}
              &middot;{" "}
              <a
                href="#"
                className="text-gray-500 hover:text-white transition-colors"
              >
                이용약관
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
