import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
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
  "200회+ 커피챗/멘토링에서 반복된 탈락 패턴 정리",
  "현직 PM 관점의 JD-경험 연결 기준 반영",
  "무조건 잘 쓴 문장보다 나의 스토리를 완성시켜주는 논리 우선",
  "지원 공고 문구와 하나씩 맞대어 보기",
  "없는 경험을 부풀리지 않고, 있는 경험에서 찾아내기",
  "면접관이 파고들 만한 질문까지 미리 짚기",
];

export function FounderNoteSection() {
  return (
    <section className="bg-fill py-24 md:py-[120px]">
      <div className="max-w-6xl mx-auto px-6 lg:px-10">
        <div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
            <div className="rounded-[28px] bg-surface p-8 md:rounded-[32px] md:p-[52px]">
              {/* 워드마크는 이미지라 헤딩 텍스트가 "왜 를 만들었나요?"로 추출된다. 이름을 sr-only 텍스트로 넣고 이미지는 장식으로 둔다. */}
              <h2 className="mb-5 text-[28px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink md:text-[44px]">
                왜 <span className="sr-only">Pre:View</span>
                <BrandName decorative variant="default" />를 만들었나요?
              </h2>
              <p className="mb-5 text-[16px] leading-[1.8] text-ink-2 md:text-[17px]">
                커피챗에서 만난 취준생들은 대부분 이미 좋은 경험을 가지고
                있었어요. 그런데 자소서에는 그 모습이 충분히 담기지 않는 경우가
                많았고, 기업들은 불합격한 이유를 알려주지 않습니다.
              </p>
              <p className="mb-6 text-[15px] leading-[1.85] text-ink-3">
                200번 넘는 멘토링에서는 비슷한 케이스들이 계속 보였어요. 경험은
                많은데 직무와 연결되지 않고 흩어져 있거나, 성과는 있지만 본인의
                판단과 깨달음이 보이지 않는 경우요. 옆에서 30분 정도 함께
                수정하면 충분히 메울 수 있는 부분들인데, 그 30분이 부족해서 계속
                불합격하는 분들이 보였습니다. 매번 제가 취준생 분들과 함께할 수는
                없기 때문에, 저의 시선을 대신 전달해줄 <BrandName variant="default" />를
                만들었습니다.
              </p>

              <div className="flex flex-col gap-3 rounded-[20px] bg-fill-soft p-6 md:p-[26px]">
                <span className="inline-flex h-[26px] w-fit items-center rounded-[8px] bg-line px-2.5 text-[13px] font-bold text-ink-3">
                  Founder note
                </span>
                <blockquote className="text-[16px] font-medium leading-[1.8] text-ink">
                  “떨어진 이유를 아무도 말해주지 않는 시간이 얼마나 막막한지
                  압니다. 그 막막함 옆에 같이 앉아, 여러분의 경험이 채용 담당자
                  입장에서 어떻게 읽히는지 짚어드리고 싶었습니다.”
                </blockquote>
              </div>
            </div>

            <div className="rounded-[28px] bg-ink p-8 text-white md:rounded-[32px] md:p-11">
              <p className="text-[22px] font-extrabold tracking-[-0.02em] text-white md:text-[24px]">
                분석 기준은 어떻게 정해졌나요?
              </p>
              <p className="mb-6 mt-3 text-[15px] leading-[1.7] text-[#B0B8C1]">
                <BrandName />가 자소서를 분석하는 기준은 ‘리포트 미리보기’에서
                보신 그대로예요. 그 기준은 이렇게 정해졌습니다.
              </p>
              <ul className="space-y-4">
                {founderSignals.map(signal => (
                  <li key={signal} className="flex items-start gap-3">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#5FD39C]"
                    />
                    <span className="text-[15px] leading-[1.6] text-white">
                      {signal}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FounderSection() {
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
      <section className="bg-fill px-6 py-24 md:py-[120px] lg:px-10">
        <div className="mx-auto max-w-7xl rounded-[28px] bg-surface px-6 py-16 text-center md:rounded-[32px] md:px-14 md:py-20">
          <h2
            className="mb-[18px] text-[28px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink md:text-[46px]"
          >
            지금 바로 자소서를 분석해보세요
          </h2>
          <p
            className="mx-auto mb-8 max-w-md text-[16px] leading-[1.7] text-ink-3 md:text-[17px]"
          >
            첫 분석은 무료입니다. 지금 자소서가 어떻게 읽히는지 먼저
            확인해보세요.
          </p>
          <div>
            {/* 일반 링크: 번들 평가가 첫 프레임 뒤로 미뤄져 있어 그 사이 탭해도 이동해야 한다(Home.tsx CTA 와 동일). */}
            <Link href="/analyze" className="landing-primary-cta group" data-funnel-cta="final">
              <span className="relative z-10">무료 분석 시작하기</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-200" />
            </Link>
            <p className="mt-[18px] text-[13px] text-ink-4">
              자소서 본문은 분석에만 사용하고, 서버 로그에 남기지 않습니다.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          Footer
          ══════════════════════════════════════════════════ */}
      <section className="border-t border-line bg-fill py-14">
        <div className="max-w-2xl mx-auto px-6 lg:px-10">
          {SHOW_NEWSLETTER_FORM && (
            <>
              {/* Newsletter */}
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold mb-2">
                  새로운 기능 소식을 가장 먼저 받아보세요
                </h3>
                <p className="text-[14px] text-ink-4">
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
                  className="flex-1 h-11 px-4 bg-surface border border-line rounded-[12px] focus:border-brand outline-none transition-colors text-[14px] text-ink placeholder:text-ink-5"
                />
                <button
                  type="submit"
                  className="bg-brand text-white h-11 px-6 text-[14px] font-bold rounded-[10px] hover:bg-brand-hover transition-colors duration-200"
                >
                  {emailSubmitted ? "완료" : "알림 신청"}
                </button>
              </form>

              {emailSubmitted && (
                <motion.p
                  className="text-center text-[13px] text-ok font-medium mb-6"
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
            className={`text-center ${SHOW_NEWSLETTER_FORM ? "pt-8 border-t border-line" : ""}`}
          >
            <div className="flex items-center justify-center mb-4">
              <Logo className="h-4 w-auto opacity-70" variant="default" />
            </div>
            <p className="text-[13px] text-ink-3">
              &copy; 2026 <BrandName variant="default" />. All rights reserved.{" "}
              <Link
                href="/privacy"
                className="text-ink-3 hover:text-ink transition-colors ml-1"
              >
                개인정보처리방침
              </Link>{" "}
              &middot;{" "}
              <Link
                href="/terms"
                className="text-ink-3 hover:text-ink transition-colors"
              >
                이용약관
              </Link>{" "}
              &middot;{" "}
              <Link
                href="/help"
                className="text-ink-3 hover:text-ink transition-colors"
              >
                고객센터
              </Link>{" "}
              &middot;{" "}
              <a
                href="mailto:hansitoring@gmail.com"
                className="text-ink-3 hover:text-ink transition-colors"
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
