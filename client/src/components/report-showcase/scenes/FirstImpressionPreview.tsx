import { AlertTriangle, Check } from "lucide-react";

import { hiringMemoryItems, mentorCommentPreviews, reportKeywords } from "../reportShowcaseSampleData";

export function FirstImpressionPreview() {
  return (
    <section className="relative py-1 lg:h-full lg:overflow-hidden">
      {/* 회사·직무 컨텍스트는 프레임 헤더가 이미 보여주므로 별도 헤더를 두지 않는다 */}
      <div className="py-2 text-center lg:py-3">
        <p className="mb-2 text-[13px] text-zinc-300">김민지님은</p>
        <h3 className="mx-auto max-w-2xl text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-[2.35rem] md:text-[2.7rem]">
          <span className="block">데이터 기반</span>
          <span className="block">실행형 PM</span>
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-[1.65] text-zinc-300 sm:text-[15px]">
          데이터 기반 실행력은 강하지만, 현대자동차 기준 모빌리티 임팩트 연결이
          부족합니다.
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-2 pb-3">
        {reportKeywords.map(keyword => (
          <span
            key={keyword}
            className="rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-2 text-xs font-semibold text-zinc-300"
          >
            {keyword}
          </span>
        ))}
      </div>

      <div className="relative z-0 grid items-start gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-3">
          <p className="mb-2 text-sm font-semibold text-white">
            채용담당자가 기억할 모습
          </p>
          <ul className="space-y-1.5">
            {hiringMemoryItems.map(item => (
              <li
                key={item.text}
                className="grid grid-cols-[20px_1fr] gap-2 text-[12px] leading-[1.4] text-zinc-300"
              >
                <span
                  className={`mt-0.5 inline-flex size-[18px] items-center justify-center rounded-full border ${
                    item.mark === "✓"
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/30 bg-amber-400/10 text-amber-200"
                  }`}
                >
                  {item.mark === "✓" ? (
                    <Check className="size-3" />
                  ) : (
                    <AlertTriangle className="size-3" />
                  )}
                </span>
                <span className="pt-px">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.028] p-3">
          <p className="mb-2 text-sm font-semibold text-white">지원자 프로필</p>
          <p className="text-[12px] leading-[1.6] text-zinc-400">
            지원자는 데이터로 고객의 이탈 원인을 좁히고, 실험 결과를 다음
            개선안에 반영하는 방식에 익숙합니다.
          </p>
          <p className="mt-2 text-[12px] leading-[1.6] text-zinc-500">
            현대자동차에서는 이 역량을 커넥티드 서비스의 기능 탐색과 재사용 경험
            개선으로 연결하면 직무 적합도가 더 선명해집니다.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
          현직자 코멘트
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {mentorCommentPreviews.map((comment, index) => (
            <blockquote key={comment.title} className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`text-[24px] font-extrabold leading-none tracking-[0.08em] opacity-60 ${comment.numberClassName}`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="text-[12px] font-bold text-zinc-100">
                  {comment.title}
                </p>
              </div>
              <p className="text-[11px] leading-[1.5] text-zinc-300">
                {comment.text}
              </p>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
