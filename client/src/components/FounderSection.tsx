import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  MessageSquareText,
  PenLine,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { BrandName } from "@/components/BrandName";
import Logo from "@/components/Logo";

/* ─────────────────────────────────────────────────────────
   FounderNoteSection — Founder Note (신뢰 섹션, 랜딩 중단 배치)
   FounderSection — CTA + Footer (랜딩 하단)
   ───────────────────────────────────────────────────────── */

// 제출된 이메일을 저장하는 백엔드가 아직 없다.
// 저장 경로를 연결한 뒤 true로 되돌리면 기존 위치에 그대로 복귀한다.
const SHOW_NEWSLETTER_FORM = false;

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

export function FounderNoteSection() {
  return (
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
              <h2 className="text-2xl md:text-4xl font-bold leading-tight tracking-tight mb-6">
                왜 <BrandName />를 만들었나요?
              </h2>
              <p className="text-gray-400 font-light text-[16px] leading-[1.9] mb-5">
                커피챗에서 만난 취준생들은 대부분 좋은 경험을 가지고 있었습니다.
                그런데 자소서에는 그 모습이 담기지 않았고, 탈락 메일은 이유를
                말해주지 않았습니다.
              </p>
              <p className="text-gray-500 font-light text-[15px] leading-[1.9] mb-8">
                100번 넘는 멘토링에서 같은 장면을 반복해서 봤습니다. 경험은
                있는데 직무와 연결되지 않고, 성과는 있는데 본인의 판단이 보이지
                않는 상태. 옆에서 30분만 같이 읽으면 메울 수 있는 빈틈인데, 그
                30분이 없어서 계속 떨어지는 사람들이 있었습니다. 모든 취준생
                옆에 앉을 수는 없기에, 그 시선을 대신 전하려고 <BrandName />를
                만들었습니다.
              </p>

              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Founder note
                </p>
                <blockquote className="text-[15px] leading-[1.85] text-zinc-300">
                  “떨어진 이유를 아무도 말해주지 않는 시간이 얼마나 막막한지
                  압니다. 그 막막함 앞에 같이 앉아, 당신의 경험이 회사의
                  기준에서 어떻게 읽히는지 짚어주는 한 사람이 되고 싶었습니다.”
                </blockquote>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#0A0A0A] p-6 md:p-7">
              <p className="text-[15px] font-semibold text-white">
                그 시선은 리포트에서 이렇게 작동합니다
              </p>
              <p className="mb-6 mt-1.5 text-[13px] leading-[1.7] text-zinc-500">
                멘토링에서 반복해 짚던 것들을, <BrandName />는 모든 리포트에서
                똑같은 순서로 봅니다.
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

              <div className="mt-6 border-t border-white/[0.06] pt-4">
                <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-600">
                  이 기준이 나온 곳
                </p>
                <ul className="space-y-1.5">
                  {founderSignals.map(signal => (
                    <li
                      key={signal}
                      className="grid grid-cols-[10px_1fr] gap-1.5 text-[12.5px] leading-[1.6] text-zinc-500"
                    >
                      <span aria-hidden="true" className="text-zinc-700">
                        ·
                      </span>
                      {signal}
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
            첫 분석은 무료입니다. 지금 자소서가 어떻게 읽히는지 먼저
            확인해보세요.
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
              className="landing-primary-cta group"
              onClick={() => navigate("/analyze")}
            >
              <span className="relative z-10">무료 분석 시작하기</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </button>
            <p className="mt-3.5 text-[12.5px] text-zinc-500">
              자소서 본문은 분석에만 사용하고, 서버 로그에 남기지 않습니다.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          Footer
          ══════════════════════════════════════════════════ */}
      <section className="py-16 border-t border-white/[0.04]">
        <div className="max-w-2xl mx-auto px-6 lg:px-10">
          {SHOW_NEWSLETTER_FORM && (
            <>
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
                  onChange={e => setEmail(e.target.value)}
                  placeholder="이메일 주소를 입력해주세요"
                  required
                  className="flex-1 h-11 px-4 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all text-[14px] text-white placeholder:text-gray-600"
                />
                <button
                  type="submit"
                  className="bg-white text-black h-11 px-6 text-[13px] font-semibold rounded-xl hover:bg-gray-200 transition-colors duration-200"
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
            </>
          )}

          {/* Bottom bar */}
          <div
            className={`text-center ${SHOW_NEWSLETTER_FORM ? "pt-8 border-t border-white/[0.04]" : ""}`}
          >
            <div className="flex items-center justify-center mb-4">
              <Logo className="h-3.5 w-auto opacity-60" />
            </div>
            <p className="text-[12px] text-gray-500">
              &copy; 2026 <BrandName />. All rights reserved.{" "}
              <Link
                href="/privacy"
                className="text-gray-400 hover:text-white transition-colors ml-1"
              >
                개인정보처리방침
              </Link>{" "}
              &middot;{" "}
              <Link
                href="/terms"
                className="text-gray-400 hover:text-white transition-colors"
              >
                이용약관
              </Link>{" "}
              &middot;{" "}
              <a
                href="mailto:hansitoring@gmail.com"
                className="text-gray-400 hover:text-white transition-colors"
              >
                문의 hansitoring@gmail.com
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
