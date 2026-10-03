import { Plus, Trash2 } from "lucide-react";
import type { AutosaveState } from "@/hooks/useDraftAutosave";
import { countChars, type ApplicationQuestionDraft } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const MAX_QUESTIONS = 5;
const COPY = WORKSPACE_COPY.editor;

function saveLabel(state: AutosaveState): string {
  if (state === "idle") return "";
  return WORKSPACE_COPY.save[state];
}

export default function ApplicationEditor({
  questions,
  activeIndex,
  onSelect,
  onChange,
  onAdd,
  onRemove,
  saveState,
}: {
  questions: ApplicationQuestionDraft[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onChange: (index: number, patch: Partial<ApplicationQuestionDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  saveState: AutosaveState;
}) {
  const active = questions[activeIndex];
  const counts = countChars(active?.answer ?? "");
  const over = active?.charLimit != null && counts.withSpaces > active.charLimit;
  const failed = saveState === "error" || saveState === "conflict";

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.06] px-3 pt-3">
        {questions.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={index === activeIndex ? "true" : undefined}
            className={`shrink-0 rounded-t-lg px-3 py-2 text-[13px] ${
              index === activeIndex ? "bg-white/[0.06] text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {`문항 ${index + 1}`}
          </button>
        ))}
        {questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            onClick={onAdd}
            className="ml-1 inline-flex shrink-0 items-center gap-1 px-2 py-2 text-[13px] text-zinc-500 hover:text-zinc-300"
          >
            <Plus className="h-3.5 w-3.5" /> {COPY.addQuestion}
          </button>
        )}
        <span
          className={`ml-auto shrink-0 pb-2 pl-3 text-[12px] ${failed ? "text-red-400" : "text-zinc-500"}`}
          role={failed ? "alert" : undefined}
          aria-live="polite"
        >
          {saveLabel(saveState)}
        </span>
      </div>

      {active && (
        <div className="space-y-3 p-4">
          <div className="flex gap-2">
            <input
              value={active.prompt}
              onChange={(e) => onChange(activeIndex, { prompt: e.target.value })}
              placeholder={COPY.promptPlaceholder}
              maxLength={300}
              className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            <input
              type="number"
              min={1}
              max={10000}
              value={active.charLimit ?? ""}
              onChange={(e) => onChange(activeIndex, { charLimit: e.target.value ? Number(e.target.value) : null })}
              aria-label={COPY.charLimitLabel}
              placeholder={COPY.charLimitLabel}
              className="w-28 rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(activeIndex)}
                aria-label={COPY.removeQuestion}
                className="px-2 text-zinc-500 hover:text-zinc-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <textarea
            value={active.answer}
            onChange={(e) => onChange(activeIndex, { answer: e.target.value })}
            placeholder={COPY.answerPlaceholder}
            maxLength={6000}
            rows={14}
            className="w-full resize-y rounded-lg border border-white/[0.08] bg-transparent px-3 py-3 text-[15px] leading-relaxed text-zinc-100 placeholder:text-zinc-600"
          />
          <p className={`text-right text-[12px] ${over ? "text-red-400" : "text-zinc-500"}`}>
            {COPY.charCount(counts.withSpaces, counts.withoutSpaces)}
            {active.charLimit != null && ` / ${active.charLimit}자`}
            {over && ` · ${COPY.overLimit}`}
          </p>
        </div>
      )}
    </section>
  );
}
