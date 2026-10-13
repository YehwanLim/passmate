import { ChevronRight } from "lucide-react";
import type { JobPostingDetail } from "@/constants/jobPostingDetails";

/** 전형 절차를 번호 붙은 단계 칸으로. 부문마다 다르면 부문 이름을 붙여 줄을 나눈다. 공고 한 장과 기업 분석 리포트가 함께 쓴다. */
export function ProcessSteps({ detail }: { detail: Pick<JobPostingDetail, "process" | "processNote"> }) {
  return (
    <div className="grid gap-5">
      {detail.process.map(track => (
        <div key={track.name ?? "all"}>
          {track.name && <p className="mb-2.5 text-[14px] font-semibold text-ink-3">{track.name}</p>}
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-2.5">
            {track.steps.map((step, index) => (
              <li key={step} className="flex items-center gap-1.5">
                {index > 0 && <ChevronRight className="size-4 shrink-0 text-ink-5" aria-hidden="true" />}
                <span className="inline-flex items-center gap-2 rounded-[12px] bg-fill px-3 py-2 text-[15px] font-semibold text-ink [word-break:keep-all]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {detail.processNote && <p className="text-[14px] text-ink-4 [word-break:keep-all]">{detail.processNote}</p>}
    </div>
  );
}
