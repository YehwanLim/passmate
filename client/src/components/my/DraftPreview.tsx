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
    <div className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="space-y-1.5">
        <p className="text-[12px] text-zinc-500">{COPY.chosenLabel}</p>
        {draft.chosen.map((c) => (
          <p key={c.experienceId} className="text-[13px] text-zinc-300">
            <span className="font-semibold text-zinc-100">{c.title}</span>
            <span className="text-zinc-500"> · </span>
            <span>{c.reason}</span>
          </p>
        ))}
      </div>

      <div className="space-y-2 text-[15px] leading-relaxed text-zinc-100">
        {draft.sentences.map((s, i) => {
          const sources = s.sourceIds.map((id) => titleOf.get(id)).filter(Boolean).join(", ");
          return (
            <p key={i}>
              {splitBlanks(s.text).map((part, j) =>
                part.blank ? (
                  <mark key={j} className="rounded bg-yellow-300/20 px-0.5 text-yellow-200">
                    {part.text}
                  </mark>
                ) : (
                  <span key={j}>{part.text}</span>
                )
              )}
              {sources && <span className="ml-1.5 text-[11px] text-zinc-500">{COPY.sourceLabel(sources)}</span>}
              {s.unsourced && <span className="mt-0.5 block text-[12px] text-zinc-500">{COPY.unsourced}</span>}
            </p>
          );
        })}
      </div>

      {hasBlank && <p className="text-[12px] text-yellow-200/80">{COPY.blankHint}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-zinc-500">
          {draft.charCount}자 · {COPY.remaining(draft.remainingToday)}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg px-3 text-[13px] text-zinc-400 hover:text-zinc-200"
          >
            {COPY.close}
          </button>
          <button
            type="button"
            onClick={onRetry}
            disabled={!canRetry}
            className="h-9 rounded-lg border border-white/[0.12] px-3 text-[13px] text-zinc-200 disabled:opacity-50"
          >
            {COPY.retry}
          </button>
          <button
            type="button"
            onClick={apply}
            className="h-9 rounded-lg bg-white px-3 text-[13px] font-semibold text-black"
          >
            {COPY.apply}
          </button>
        </div>
      </div>
    </div>
  );
}
