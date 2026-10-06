import type { DraftOk } from "@/lib/experienceDraft";
import { splitBlanks } from "@/lib/experienceDraft";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.draft;

/** 초안 미리보기. 문장마다 출처, 빈칸은 노란 표시. "채우기" 전에는 답 칸을 건드리지 않는다. */
export default function DraftPreview({
  draft,
  hasAnswer,
  canRetry = true,
  onApply,
  onRetry,
  onClose,
}: {
  draft: DraftOk;
  hasAnswer: boolean;
  /** 오늘 무료 초안을 다 썼으면 false */
  canRetry?: boolean;
  onApply: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const titleOf = new Map(draft.chosen.map((c) => [c.experienceId, c.title]));
  const hasBlank = draft.sentences.some((s) => splitBlanks(s.text).some((p) => p.blank));

  const apply = () => {
    if (hasAnswer && !window.confirm(COPY.confirmReplace)) return;
    onApply();
  };

  return (
    <div className="space-y-4 rounded-2xl bg-fill-soft p-5">
      <div className="space-y-1.5">
        <p className="text-[12.5px] font-semibold text-ink-4">{COPY.chosenLabel}</p>
        {draft.chosen.map((c) => (
          <p key={c.experienceId} className="text-[14px] leading-relaxed text-ink-3">
            <span className="font-bold text-ink">{c.title}</span>
            <span className="text-ink-5"> · </span>
            <span>{c.reason}</span>
          </p>
        ))}
      </div>

      <div className="space-y-2 text-[15px] leading-[1.75] text-ink">
        {draft.sentences.map((s, i) => {
          const sources = s.sourceIds.map((id) => titleOf.get(id)).filter(Boolean).join(", ");
          return (
            <p key={i}>
              {splitBlanks(s.text).map((part, j) =>
                part.blank ? (
                  <mark key={j} className="rounded bg-blank-soft px-1 font-semibold text-blank">
                    {part.text}
                  </mark>
                ) : (
                  <span key={j}>{part.text}</span>
                )
              )}
              {sources && <span className="ml-1.5 text-[12px] text-ink-4">{COPY.sourceLabel(sources)}</span>}
              {s.unsourced && <span className="mt-0.5 block text-[13px] text-blank">{COPY.unsourced}</span>}
            </p>
          );
        })}
      </div>

      {hasBlank && <p className="text-[13px] text-blank">{COPY.blankHint}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-4">
          {draft.charCount}자 · {COPY.remaining(draft.remainingToday)}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-[10px] px-3 text-[14px] font-semibold text-ink-4 hover:bg-fill hover:text-ink-2"
          >
            {COPY.close}
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetry}
            className="h-10 rounded-[10px] border border-line bg-surface px-3.5 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-fill disabled:opacity-50"
          >
            {COPY.retry}
          </button>
          <button
            type="button"
            onClick={apply}
            className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-bold text-white transition-colors hover:bg-brand-hover"
          >
            {COPY.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
