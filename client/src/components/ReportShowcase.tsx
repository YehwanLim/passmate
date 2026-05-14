import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

const STEPS = [
  { headline: "합격 가능성 진단", text: "현직자 수준의 시각으로 강점과 약점을 즉시 파악하고, 현재 자소서의 객관적인 위치를 한눈에 확인해보세요", img: "/report-step-1.png" },
  { headline: "문장 분석", text: "모호한 표현은 삭제하고, 여러분의 경험이 '성과'로 돋보일 수 있도록 문장 단위로 디테일하게 분석합니다.", img: "/report-step-2.png", img2: "/report-step-2b.png" },
  { headline: "면접 대비 꼬리 질문", text: "실제 면접관이 던질 법한 날카로운 질문들을 미리 확인하고, 합격을 부르는 답변의 방향성까지 완벽하게 준비하세요.", img: "/report-step-3.png" },
  { headline: "우선순위 가이드", text: "무엇부터 고쳐야 할지 고민하지 마세요. 가장 효과적인 보완 포인트를 우선순위별로 정리한 맞춤형 플랜을 제공합니다.", img: "/report-step-4.png" },
];

const SP = { stiffness: 80, damping: 20 };

export default function ReportShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const o1 = useSpring(useTransform(scrollYProgress, [0.01,0.06,0.20,0.25], [0,1,1,0]), SP);
  const o2 = useSpring(useTransform(scrollYProgress, [0.25,0.30,0.45,0.50], [0,1,1,0]), SP);
  const o3 = useSpring(useTransform(scrollYProgress, [0.50,0.55,0.70,0.75], [0,1,1,0]), SP);
  const o4 = useSpring(useTransform(scrollYProgress, [0.75,0.80,0.95,0.98], [0,1,1,1]), SP);
  const textOps = [o1, o2, o3, o4];

  const i1 = useSpring(useTransform(scrollYProgress, [0.01,0.06,0.22,0.25], [0,1,1,0]), SP);
  const i2 = useSpring(useTransform(scrollYProgress, [0.25,0.30,0.47,0.50], [0,1,1,0]), SP);
  const i3 = useSpring(useTransform(scrollYProgress, [0.50,0.55,0.72,0.75], [0,1,1,0]), SP);
  const i4 = useSpring(useTransform(scrollYProgress, [0.75,0.80,0.95,0.98], [0,1,1,1]), SP);
  const imgOps = [i1, i2, i3, i4];

  const accOp = useSpring(useTransform(scrollYProgress, [0.35,0.40], [0,1]), SP);
  const sc = useSpring(useTransform(scrollYProgress, [0,0.06,0.92], [0.98,1.02,1.02]), SP);

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      if (v<0.25) setStep(0); else if (v<0.5) setStep(1); else if (v<0.75) setStep(2); else setStep(3);
    });
  }, [scrollYProgress]);

  return (
    <section className="relative border-t border-white/[0.04]">
      <div ref={ref} className="relative" style={{ height: "400vh" }}>
        <div className="sticky top-0 h-screen flex flex-col overflow-hidden">
          <div className="flex-shrink-0 pt-14 pb-6 text-center px-6">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-4">
              <span className="w-4 h-px bg-gray-700" />
              리포트 미리보기
            </span>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">합격을 설계하는 인사이트 리포트</h2>
          </div>

          <div className="flex-1 flex flex-col lg:flex-row items-stretch gap-4 lg:gap-8 px-4 lg:px-8 max-w-[1400px] mx-auto w-full min-h-0 pb-10">
            {/* LEFT — wider, no border at all */}
            <div className="relative overflow-hidden w-full" style={{ flex: "1.4" }}>
              <div className="relative w-full h-full">
                {STEPS.map((s, idx) => (
                  <motion.div key={idx} className="absolute inset-0" style={{ opacity: imgOps[idx] }}>
                    <motion.div className="w-full h-full overflow-hidden" style={{ scale: sc }}>
                      <img src={s.img} alt={s.headline} className="w-full h-full object-contain" draggable={false} />
                      {idx === 1 && s.img2 && (
                        <motion.img
                          src={s.img2}
                          alt="accordion open"
                          className="absolute inset-0 w-full h-full object-contain"
                          draggable={false}
                          style={{ opacity: accOp }}
                        />
                      )}
                    </motion.div>
                  </motion.div>
                ))}
                {/* Strong edge fade — covers any blue glow from screenshots */}
                <div className="absolute inset-0 pointer-events-none z-10">
                  <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
                  <div className="absolute top-0 bottom-0 left-0 w-16 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
                  <div className="absolute top-0 bottom-0 right-0 w-16 bg-gradient-to-l from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />
                </div>
              </div>
            </div>

            {/* RIGHT — narrower */}
            <div className="relative flex items-center justify-center min-h-[280px]" style={{ flex: "0.8" }}>
              <div className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 hidden lg:flex flex-col gap-3">
                {[0,1,2,3].map(i=>(
                  <div key={i} className="w-1 h-6 rounded-full transition-all duration-500" style={{backgroundColor:step===i?"rgba(59,130,246,0.8)":"rgba(255,255,255,0.06)"}} />
                ))}
              </div>
              {STEPS.map(({headline,text},i) => (
                <motion.div key={i} className="absolute inset-0 flex flex-col justify-center px-6 lg:px-16" style={{opacity:textOps[i]}}>
                  <span className="text-[11px] font-semibold text-blue-400 tracking-wider mb-3 block">0{i+1}</span>
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 leading-snug">{headline}</h3>
                  <p className="text-[15px] text-gray-400 font-light leading-[1.85] max-w-sm">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
