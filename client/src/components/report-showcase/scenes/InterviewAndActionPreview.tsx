import { Check } from "lucide-react";

import { actionItems, interviewQuestions } from "../reportShowcaseSampleData";

export function InterviewAndActionPreview() {
  return (
    <section className="flex flex-col gap-4 py-1 lg:h-full lg:overflow-hidden">
      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.86fr)]">
        <div>
          <h3 className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-1 font-medium">
            04. 예상 질문
          </h3>
          <p className="text-xl font-semibold text-white mb-3 tracking-tight">
            면접에서는 이런 질문이 나올 수 있어요
          </p>
          <div className="flex flex-1 flex-col gap-2">
            {interviewQuestions.map((item, index) => (
              <div
                key={item.question}
                className="flex flex-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
              >
                <div className="flex items-start gap-3 text-left">
                  <span className="mt-0.5 min-w-[25px] text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    Q{index + 1}
                  </span>
                  <div className="flex-1">
                    <p className="text-[12px] leading-[1.55] text-zinc-200">
                      {item.question}
                    </p>
                    <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
                      <p className="text-[11px] font-semibold text-zinc-100">
                        답변에서 설명할 근거
                      </p>
                      <p className="mt-1 text-[11px] leading-[1.5] text-zinc-500">
                        {item.answerFocus}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          <h3 className="text-xs uppercase tracking-[0.15em] text-zinc-500 mb-1 font-medium">
            05. 액션 플랜
          </h3>
          <p className="text-xl font-semibold text-white mb-3 tracking-tight">
            가장 먼저 고칠 부분부터 정리합니다
          </p>
          <div className="flex flex-1 flex-col gap-2">
            {actionItems.map((item, index) => (
              <div
                key={item}
                className="flex flex-1 items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div
                  className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${index === 0 ? "border-indigo-500 bg-indigo-500" : "border-zinc-700"}`}
                >
                  {index === 0 && <Check className="h-3 w-3 text-white" />}
                </div>
                <div>
                  <p className="text-[12px] leading-[1.45] text-zinc-200">
                    {item}
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-400/50">
                    예상 효과: 지원 회사와 경험의 연결성이 선명해집니다.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
