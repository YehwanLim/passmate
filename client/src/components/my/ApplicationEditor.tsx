import { Plus, Trash2 } from "lucide-react";
import type { AutosaveState } from "@/hooks/useDraftAutosave";
import { countChars, type ApplicationQuestionDraft } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const MAX_QUESTIONS = 5;
const COPY = WORKSPACE_COPY.editor;
const MAX_CHAR_LIMIT = 10000;

// 서버가 1..10000 정수만 받는다. 그 밖의 입력은 제한 없음(null)으로 두어 저장이 막히지 않게 한다.
export function parseCharLimit(raw: string): number | null {
  const value = Number(raw);
  return raw.trim() !== "" && Number.isInteger(value) && value >= 1 && value <= MAX_CHAR_LIMIT ? value : null;
}

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
            {WORKSPACE_COPY.questionLabel(index + 1)}
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
          {/* 문항 원문은 길어서 한 줄 칸이면 폰에서 잘린다 — 줄바꿈되는 칸으로 두고, 폰에서는 글자 수 칸을 아래로 내린다 */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <textarea
              value={active.prompt}
              onChange={(e) => onChange(activeIndex, { prompt: e.target.value.replace(/\n/g, " ") })}
              placeholder={COPY.promptPlaceholder}
              maxLength={300}
              rows={2}
              className="min-w-0 basis-full resize-none rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 sm:basis-auto sm:flex-1"
            />
            <input
              type="number"
              min={1}
              max={MAX_CHAR_LIMIT}
              value={active.charLimit ?? ""}
              onChange={(e) => onChange(activeIndex, { charLimit: parseCharLimit(e.target.value) })}
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
