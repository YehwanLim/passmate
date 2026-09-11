import { useState } from "react";
import { Check } from "lucide-react";

import { UI_LABELS } from "@/constants/labels";
import type { ActionItem } from "@/types/report";
import { SectionNumber } from "../SectionNumber";
import { renderRichText } from "../richText";

/** ACT 5 — 다음 단계: 체크 가능한 액션 플랜과 진행률. 체크 상태는 화면에만 남는다. */
export function ActionPlanSection({ tasks }: { tasks: ActionItem[] }) {
  const [completedTasks, setCompletedTasks] = useState<number[]>([]);

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => (prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]));
  };

  const taskProgress = Math.round((completedTasks.length / tasks.length) * 100);

  return (
    <section id="section-action-plan" className="py-24 section-divider">
      <h3 className="text-xl sm:text-2xl font-semibold text-white mb-6 tracking-tight"><SectionNumber value="06" />{UI_LABELS.ACTION_PLAN_TITLE}</h3>

      <div className="flex items-center gap-5 mb-14 mt-10">
        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-indigo-500/70 transition-all duration-500" style={{ width: `${taskProgress}%` }} />
        </div>
        <span className="text-sm text-zinc-500 tabular-nums">{completedTasks.length}/{tasks.length}</span>
      </div>

      <div className="space-y-0">
        {tasks.map((task, index) => {
          const isComplete = completedTasks.includes(index);
          return (
            <button key={index} onClick={() => toggleTask(index)} className="w-full text-left py-5 flex items-start gap-5 group border-b border-white/[0.03] last:border-0">
              <div className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors mt-0.5 ${isComplete ? "bg-indigo-500 border-indigo-500" : "border-zinc-700 group-hover:border-zinc-500"}`}>
                {isComplete && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className={`text-base transition-colors leading-[1.6] block mb-1.5 ${isComplete ? "line-through text-zinc-600" : "text-zinc-200 group-hover:text-white"}`}>{renderRichText(task.title)}</span>
                <p className={`text-[15px] transition-colors leading-[1.7] ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{renderRichText(task.description)}</p>
                <p className={`text-sm mt-2.5 transition-colors ${isComplete ? "text-zinc-700" : "text-zinc-500"}`}>{UI_LABELS.EXPECTED_IMPACT}: {renderRichText(task.expectedImpact)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
