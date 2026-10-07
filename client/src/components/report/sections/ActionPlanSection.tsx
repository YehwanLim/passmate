import { useState } from "react";
import { Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { ActionItem } from "@/types/report";
import { renderRichText } from "../richText";

/** 다음 단계: 체크 가능한 할 일과 진행률. ReportBlock 안에 들어간다. 체크 상태는 화면에만 남는다. */
export function ActionPlanSection({ tasks }: { tasks: ActionItem[] }) {
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const taskProgress = tasks.length > 0 ? Math.round((completedTasks.length / tasks.length) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center gap-4">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-fill">
          <div className="h-full bg-ok transition-all duration-500" style={{ width: `${taskProgress}%` }} />
        </div>
        <span className="text-[14px] tabular-nums text-ink-4">{completedTasks.length}/{tasks.length}</span>
      </div>

      <div>
        {tasks.map((task, index) => {
          const isComplete = completedTasks.includes(index);
          return (
            <button key={index} onClick={() => toggleTask(index)} className="group flex w-full items-start gap-4 border-b border-line-soft py-4 text-left last:border-0">
              <div className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors ${isComplete ? "border-ok bg-ok" : "border-[#C9CED4] group-hover:border-ink-5"}`}>
                {isComplete && <Check className="size-3 text-white" strokeWidth={3.2} />}
              </div>
              <div className="min-w-0 flex-1">
                <span className={`mb-1 block text-[16px] font-bold leading-[1.5] transition-colors ${isComplete ? "text-ink-5 line-through" : "text-ink"}`}>{renderRichText(task.title)}</span>
                <p className={`text-[15px] leading-[1.65] transition-colors ${isComplete ? "text-ink-5" : "text-ink-3"}`}>{renderRichText(task.description)}</p>
                <p className={`mt-1.5 text-[14px] transition-colors ${isComplete ? "text-ink-5" : "text-ink-4"}`}>{UI_LABELS.EXPECTED_IMPACT}: {renderRichText(task.expectedImpact)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
