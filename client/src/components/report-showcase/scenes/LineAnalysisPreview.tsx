import { Check } from "lucide-react";

import { previewAnswer } from "../reportShowcaseSampleData";

export function LineAnalysisPreview() {
  return (
    <section className="flex flex-col gap-3 py-1 lg:h-full lg:overflow-hidden">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col">
          <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-500">
            03. 문장별 상세 진단
          </h3>
          <p className="mt-1 text-xl font-semibold tracking-tight text-white">
            원문 옆에서 바로 확인하는 AI 코멘터리
          </p>
        </div>
        <span className="hidden rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[11px] font-medium text-zinc-500 sm:inline-flex">
          문항 1 · 피드백이 필요한 문장 4곳
        </span>
      </div>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-3 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            <span>현대자동차 · 김민지 (예시)</span>
            <span>자소서 문항 1</span>
          </div>
          <p className="mb-3 text-[12px] leading-[1.55] text-zinc-400">
            자신이 주도적으로 문제를 발견하고 해결한 경험에 대해 서술해 주세요.
          </p>
          <p className="text-[12.5px] leading-[1.82] text-zinc-400">
            {previewAnswer.map(line =>
              line.type === "neutral" ? (
                <span key={line.text}>{line.text} </span>
              ) : (
                <span key={line.text}>
                  <span
                    className={`box-decoration-clone rounded-[4px] px-1 py-0.5 ${
                      line.type === "praise"
                        ? "bg-emerald-300/[0.18] text-emerald-100"
                        : "bg-amber-200/[0.18] text-amber-100"
                    }`}
                  >
                    <span
                      className={`mr-1 text-[9.5px] font-bold ${
                        line.type === "praise"
                          ? "text-emerald-300"
                          : "text-amber-200"
                      }`}
                    >
                      {line.mark}
                    </span>
                    {line.text}
                  </span>{" "}
                </span>
              )
            )}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:h-full lg:flex-col">
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.04] p-3.5 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-white">소제목 진단</p>
              <span className="rounded-full bg-amber-200/15 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                보완
              </span>
            </div>
            <p className="text-[12px] leading-[1.55] text-zinc-300">
              성과는 드러나지만, 어떤 비즈니스 문제를 해결했는지 목적을 먼저
              보여주면 좋습니다.
            </p>
            <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              수정 방향
            </p>
            <p className="mt-1 text-[12px] font-medium leading-[1.5] text-zinc-100">
              서비스 탐색 이탈률 방어를 위한 3,000건의 고객 데이터 분석
            </p>
          </div>

          <div className="rounded-xl border border-amber-200/[0.3] bg-amber-200/[0.07] p-3.5 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <span className="inline-flex items-center rounded-[4px] bg-amber-200/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                  문장 05
                </span>
                수정 제안
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                Why
              </span>
            </div>
            <p className="text-[12.5px] font-medium leading-[1.55] text-amber-50">
              고객군을 나눈 기준을 문장 안에 넣어야 합니다.
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200/80">
              판단 근거
            </p>
            <p className="mt-1 text-[11px] leading-[1.5] text-zinc-300">
              분석 기준이 보이면, 성과가 재현 가능한 판단으로 읽힙니다.
            </p>
            <p className="mt-2 border-t border-amber-200/[0.14] pt-2 text-[11px] leading-[1.5] text-zinc-400">
              <span className="mr-1 font-semibold text-amber-200/80">
                수정 예시
              </span>
              신규 가입 후 3일 이내 이탈한 고객군에서 추천 콘텐츠 진입률이
              낮다는 점을 확인했습니다.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-300/[0.28] bg-emerald-300/[0.06] p-3.5 sm:col-span-2 lg:flex-1">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <span className="inline-flex items-center rounded-[4px] bg-emerald-300/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
                  문장 03
                </span>
                강점으로 유지
              </p>
              <Check className="h-3.5 w-3.5 text-emerald-200" />
            </div>
            <p className="text-[12.5px] font-medium leading-[1.55] text-emerald-50">
              직접 수집한 데이터 규모가 실행력을 설득합니다. 이 수치는 그대로
              남기고, 수집 기준만 한 줄 덧붙이세요.
            </p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200/80">
              면접에서 이어질 질문
            </p>
            <p className="mt-1 text-[11px] leading-[1.5] text-zinc-300">
              어떤 기준으로 데이터를 정제했고, 그 기준이 다음 실험에 어떻게
              반영됐는지까지 준비하세요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
