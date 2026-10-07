import { ChevronDown } from "lucide-react";

/* ─────────────────────────────────────────────────────────
   ProcessSection — 3-Step "How to Use" vertical timeline
   ───────────────────────────────────────────────────────── */

const steps = [
  {
    num: "01",
    title: "자소서 붙여넣기",
    description:
      "이미 써둔 자소서 문항을 그대로 붙여넣습니다. 문항은 최대 5개까지 한 번에 볼 수 있습니다.",
  },
  {
    num: "02",
    title: "지원 기업·직무 입력",
    description:
      "어느 회사, 어떤 직무에 내는 자소서인지 알려주세요. 리포트는 그 기준으로 읽습니다.",
  },
  {
    num: "03",
    title: "리포트 확인",
    description:
      "1분 안에 첫인상부터 문장 피드백, 예상 질문까지 담긴 리포트가 도착합니다.",
  },
];

export default function ProcessSection() {
  return (
    <section className="bg-fill-soft py-24 md:py-[120px]">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        {/* Heading */}
        <div className="mb-14 text-center md:mb-[72px]">
          <h2 className="mb-4 text-[30px] font-extrabold leading-[1.3] tracking-[-0.035em] text-ink md:text-[46px]">
            리포트까지, 3단계면 충분합니다
          </h2>
          <p className="mx-auto max-w-lg text-[16px] leading-[1.7] text-ink-3 md:text-[17px]">
            붙여넣고, 회사를 알려주고, 1분 기다리면 됩니다. 예약도 견적도 필요
            없습니다.
          </p>
        </div>

        {/* Timeline — 번호 원 사이를 회색 선으로 잇고, 마지막 단계만 파랑으로 채운다 */}
        <div className="mx-auto max-w-3xl">
          {steps.map(({ num, title, description }, i) => {
            const isLast = i === steps.length - 1;
            return (
              <div key={num} className="grid grid-cols-[48px_minmax(0,1fr)] gap-4 md:grid-cols-[64px_minmax(0,1fr)] md:gap-7">
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 border-brand text-[18px] font-extrabold md:h-16 md:w-16 md:text-[22px] ${
                      isLast ? "bg-brand text-white" : "bg-surface text-brand-ink"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {!isLast && (
                    <>
                      <div className="w-0.5 flex-1 bg-line" />
                      <ChevronDown aria-hidden="true" className="my-1 h-4 w-4 flex-none text-ink-5" strokeWidth={2.4} />
                      <div className="w-0.5 flex-1 bg-line" />
                    </>
                  )}
                </div>
                <div className={isLast ? "" : "pb-10 md:pb-14"}>
                  <div className="flex flex-col gap-2.5 rounded-[24px] bg-surface p-7 shadow-[0_2px_12px_rgba(25,31,40,0.04)] md:rounded-[28px] md:px-10 md:py-9">
                    <span className="inline-flex h-[26px] w-fit items-center rounded-[8px] bg-fill px-2.5 text-[13px] font-bold text-ink-3">
                      Step {num}
                    </span>
                    <h3 className="text-[20px] font-extrabold tracking-[-0.02em] text-ink md:text-[22px]">
                      {title}
                    </h3>
                    <p className="text-[15px] leading-[1.7] text-ink-3 md:text-[16px]">
                      {description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
