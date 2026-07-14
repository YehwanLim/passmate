import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, MessageSquareText, PenLine } from "lucide-react";
import { Link, useLocation } from "wouter";
import Logo from "@/components/Logo";

/* ─────────────────────────────────────────────────────────
   FounderSection — Founder Profile + CTA + Footer
   ───────────────────────────────────────────────────────── */

const founderSignals = [
  "100회+ 커피챗/멘토링에서 반복된 탈락 패턴 정리",
  "현직 PM 관점의 JD-경험 연결 기준 반영",
  "좋은 문장보다 면접에서 방어 가능한 논리 우선",
  "첫 분석은 무료, 이후 필요한 만큼만 이용",
];

const reviewPrinciples = [
  {
    icon: MessageSquareText,
    title: "면접관이 기억할 첫인상",
    text: "지원자가 어떤 사람으로 읽히는지 먼저 정리합니다.",
  },
  {
    icon: PenLine,
    title: "문장별 논리와 근거",
    text: "모호한 표현보다 실제 행동, 판단, 결과가 보이는지 봅니다.",
  },
  {
    icon: CheckCircle2,
    title: "바로 고칠 우선순위",
    text: "전부 뜯어고치기보다 합격 가능성에 영향이 큰 부분부터 제안합니다.",
  },
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
          Founder Note
          ══════════════════════════════════════════════════ */}
      <section className="py-28 md:py-36 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
            viewport={{ once: true, margin: "-80px" }}
          >
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-6">
                  <span className="w-4 h-px bg-gray-700" />
                  소개
                </span>
                <h2 className="text-2xl md:text-4xl font-bold leading-tight tracking-tight mb-6">
                  왜 PassMate를 만들었나요?
                </h2>
                <p className="text-gray-400 font-light text-[16px] leading-[1.9] mb-5">
                  합격하는 자소서는 글을 잘 쓰는 문서가 아니라, 읽는 사람이
                  &ldquo;이 사람을 만나보고 싶다&rdquo;고 판단할 수 있는 근거가
                  정리된 문서에 가깝습니다.
                </p>
                <p className="text-gray-500 font-light text-[15px] leading-[1.9] mb-8">
                  멘토링을 하다 보면 많은 지원자가 같은 문제에서 막혔습니다.
                  경험은 있는데 직무와 연결되지 않고, 성과는 있는데 본인의
                  판단이 보이지 않고, 문장은 매끄럽지만 면접 질문에는 약한
                  상태였습니다. PassMate는 그 빈틈을 빠르게 발견하고 고칠
                  순서를 알려주기 위해 만들었습니다.
                </p>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Founder note
                  </p>
                  <blockquote className="text-[15px] leading-[1.85] text-zinc-300">
                    “자소서 첨삭은 예쁜 표현을 골라주는 일이 아니라, 지원자의
                    경험이 회사의 기준에서 어떻게 읽히는지 번역해주는 일이라고
                    생각합니다.”
                  </blockquote>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-6">
                  <p className="mb-5 text-sm font-semibold text-white">
                    PassMate가 보는 기준
                  </p>
                  <div className="space-y-4">
                    {reviewPrinciples.map(({ icon: Icon, title, text }) => (
                      <div key={title} className="flex items-start gap-4">
                        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-white/[0.07] bg-white/[0.03]">
                          <Icon className="h-4 w-4 text-zinc-400" />
                        </div>
                        <div>
                          <p className="mb-1 text-[14px] font-semibold text-zinc-100">
                            {title}
                          </p>
                          <p className="text-[13px] leading-[1.7] text-zinc-500">
                            {text}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {founderSignals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-[12px] font-medium text-gray-400"
                    >
                      {signal}
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
            첫 분석은 무료입니다. 지금 자소서가 어떻게 읽히는지 먼저 확인해보세요.
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
              무료 분석 시작하기
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
            <div className="flex items-center justify-center mb-4">
              <Logo className="w-4 h-4" textClassName="text-[13px] text-gray-400" />
            </div>
            <p className="text-[12px] text-gray-700">
              &copy; 2026 PassMate. All rights reserved.{" "}
              <Link
                href="/privacy"
                className="text-gray-500 hover:text-white transition-colors ml-1"
              >
                개인정보처리방침
              </Link>{" "}
              &middot;{" "}
              <Link
                href="/terms"
                className="text-gray-500 hover:text-white transition-colors"
              >
                이용약관
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
