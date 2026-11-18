import { useEffect, useRef, useState } from "react";
import { APPLICATION_BOARD_COPY } from "@/copy/applicationBoardCopy";
import {
  canInsertAfter,
  currentStep,
  insertStepAfter,
  isDefaultStage,
  removeStep,
  resolveSteps,
  stageLabel,
  type StageFields,
  type StageStep,
} from "@/lib/applicationStages";

export type StagePatch = { stage?: string; stageSteps?: StageStep[]; rejected?: boolean };
const COPY = APPLICATION_BOARD_COPY.menu;
const ITEM_CLASS = "w-full rounded-[9px] px-2.5 py-2 text-left text-[13.5px] text-ink-3 hover:bg-fill-soft";

/**
 * 단계 배지 + 펼침 메뉴(11-15). 고르면 바로 저장한다(한 번 누르기). 저장 실패 처리는 onChange 를 넘긴 쪽이 한다.
 * 카드 전체가 지원서 화면 링크라, 이 안의 클릭은 바깥으로 올리지 않는다.
 */
export default function StageMenu({
  project,
  onChange,
}: {
  project: StageFields & { id: string };
  onChange: (patch: StagePatch) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const steps = resolveSteps(project.stage_steps);
  const current = currentStep(project);
  const currentName = stageLabel(current);
  const badge = project.rejected ? APPLICATION_BOARD_COPY.rejectedSuffix(currentName) : currentName;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const run = (patch: StagePatch) => {
    setOpen(false);
    setAdding(false);
    setLabel("");
    void onChange(patch);
  };

  return (
    <div ref={rootRef} className="relative z-10 inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-[8px] bg-fill px-2.5 text-[12.5px] font-bold transition-colors hover:bg-fill-soft ${
          project.rejected ? "text-ink-4" : "text-ink-2"
        }`}
      >
        {badge}
        <span aria-hidden="true" className="text-[10px] text-ink-4">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={COPY.title}
          className="absolute left-0 top-9 w-56 rounded-[14px] border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
        >
          {steps.map((step) => (
            <div key={step.key} className="flex items-center">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={step.key === current.key}
                onClick={() => run({ stage: step.key })}
                className={`flex-1 rounded-[9px] px-2.5 py-2 text-left text-[14px] hover:bg-fill-soft ${
                  step.key === current.key ? "font-bold text-ink" : "text-ink-2"
                }`}
              >
                {stageLabel(step)}
              </button>
              {!isDefaultStage(step.key) && step.key !== current.key && (
                <button
                  type="button"
                  aria-label={COPY.removeStep(stageLabel(step))}
                  onClick={() => run({ stageSteps: removeStep(steps, step.key) })}
                  className="rounded-[8px] px-2 py-1 text-[13px] text-ink-4 hover:bg-fill-soft"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          <div className="mt-1 border-t border-line-soft pt-1">
            {adding ? (
              <form
                className="flex gap-1.5 p-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!label.trim()) return;
                  run({ stageSteps: insertStepAfter(steps, current.key, label) });
                }}
              >
                <input
                  autoFocus
                  maxLength={20}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={COPY.addPlaceholder}
                  aria-label={COPY.addAfter(currentName)}
                  className="h-8 min-w-0 flex-1 rounded-[8px] border border-line px-2 text-[13.5px]"
                />
                <button type="submit" className="h-8 rounded-[8px] bg-brand px-2.5 text-[13px] font-semibold text-white">
                  {COPY.addConfirm}
                </button>
              </form>
            ) : (
              canInsertAfter(steps, current.key) && (
                <button type="button" onClick={() => setAdding(true)} className={ITEM_CLASS}>
                  {COPY.addStep}
                </button>
              )
            )}
            <button type="button" onClick={() => run({ rejected: !project.rejected })} className={ITEM_CLASS}>
              {project.rejected ? COPY.unmarkRejected : COPY.markRejected}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
