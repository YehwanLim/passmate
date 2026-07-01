import { motion } from "framer-motion";

const STEPS = [
  { 
    headline: "합격 가능성 진단", 
    text: "현직자 수준의 시각으로 강점과 약점을 즉시 파악하고, 현재 자소서의 객관적인 위치를 한눈에 확인해보세요", 
    img: "/report-step-1.png" 
  },
  { 
    headline: "문장 분석", 
    text: "모호한 표현은 삭제하고, 여러분의 경험이 '성과'로 돋보일 수 있도록 문장 단위로 디테일하게 분석합니다.", 
    img: "/report-step-2.png", 
    img2: "/report-step-2b.png" 
  },
  { 
    headline: "면접 대비 꼬리 질문", 
    text: "실제 면접관이 던질 법한 날카로운 질문들을 미리 확인하고, 합격을 부르는 답변의 방향성까지 완벽하게 준비하세요.", 
    img: "/report-step-3.png" 
  },
  { 
    headline: "우선순위 가이드", 
    text: "무엇부터 고쳐야 할지 고민하지 마세요. 가장 효과적인 보완 포인트를 우선순위별로 정리한 맞춤형 플랜을 제공합니다.", 
    img: "/report-step-4.png" 
  },
];

export default function ReportShowcase() {
  return (
    <section className="py-24 md:py-36 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        
        {/* Header */}
        <div className="text-center mb-20 md:mb-32">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-600 tracking-widest uppercase mb-4">
            <span className="w-4 h-px bg-gray-700" />
            리포트 미리보기
          </span>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">합격을 설계하는 인사이트 리포트</h2>
        </div>

        {/* Steps */}
        <div className="space-y-32 md:space-y-48">
          {STEPS.map((step, idx) => {
            const isEven = idx % 2 === 0;
            return (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-10 lg:gap-20`}
              >
                {/* Image Side */}
                <div className="w-full lg:w-3/5">
                  <div className="relative p-4 lg:p-8 group">
                    <motion.div 
                      whileHover={{ scale: 1.02 }}
                      transition={{ duration: 0.5 }}
                      className="relative z-10 w-full"
                    >
                      <img 
                        src={step.img} 
                        alt={step.headline} 
                        className="w-full h-auto object-contain rounded-lg drop-shadow-2xl" 
                        draggable={false} 
                      />
                      {step.img2 && (
                        <motion.img
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, margin: "-50px" }}
                          transition={{ duration: 0.6, delay: 0.3 }}
                          src={step.img2}
                          alt="Detail"
                          className="absolute -bottom-6 -right-6 lg:-bottom-10 lg:-right-10 w-2/3 h-auto object-contain rounded-lg drop-shadow-2xl border border-white/[0.1] bg-[#0A0A0A]"
                          draggable={false}
                        />
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* Text Side */}
                <div className="w-full lg:w-2/5 flex flex-col justify-center">
                  <span className="text-[13px] font-bold text-blue-400 tracking-widest mb-4 uppercase">
                    Step 0{idx + 1}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-5 leading-snug text-white">
                    {step.headline}
                  </h3>
                  <p className="text-[16px] text-gray-400 font-light leading-[1.8] max-w-md">
                    {step.text}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
