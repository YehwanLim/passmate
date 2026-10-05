import { Plus, Trash2 } from "lucide-react";
import { Link } from "wouter";
import DraftPreview from "@/components/my/DraftPreview";
import type { AutosaveState } from "@/hooks/useDraftAutosave";
import type { DraftResult } from "@/lib/experienceDraft";
import { countChars, type ApplicationQuestionDraft } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const MAX_QUESTIONS = 5;
const COPY = WORKSPACE_COPY.editor;
const MAX_CHAR_LIMIT = 10000;
const DRAFT = WORKSPACE_COPY.draft;
const EXPERIENCES_PATH = "/my#experiences";

/** 문항 하나의 초안 요청 상태. 한 번에 한 문항만 보여 준다. */
export type DraftUiState = { index: number; status: "loading" } | { index: number; status: "done"; result: DraftResult } | null;

export function draftNotice(result: DraftResult): string | null {
  switch (result.kind) {
    case "ok":
      return null;
    case "needs_more":
      return DRAFT.needsMore(result.needMore);
    case "no_experiences":
      return DRAFT.noExperiences;
    case "rate_limited":
      return DRAFT.rateLimited;
    case "auth_required":
      return DRAFT.authRequired;
    default:
      return DRAFT.failed;
  }
}

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
  draft,
  onRequestDraft,
  onApplyDraft,
  onCloseDraft,
  experienceTitles,
  experienceCount,
  draftLimitReached,
}: {
  questions: ApplicationQuestionDraft[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onChange: (index: number, patch: Partial<ApplicationQuestionDraft>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  saveState: AutosaveState;
  draft: DraftUiState;
  onRequestDraft: (index: number, opts?: { retry: boolean }) => void;
  onApplyDraft: (index: number) => void;
  onCloseDraft: () => void;
  experienceTitles: Map<string, string>;
  /** 모르면 null(버튼은 열어 두고 서버가 판단한다) */
  experienceCount: number | null;
  /** 오늘 무료 초안을 다 썼다(새로고침 전까지 화면이 기억한다) */
  draftLimitReached: boolean;
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
          <DraftControls
            question={active}
            index={activeIndex}
            draft={draft && draft.index === activeIndex ? draft : null}
            onRequestDraft={onRequestDraft}
            onApplyDraft={onApplyDraft}
            onCloseDraft={onCloseDraft}
            experienceTitles={experienceTitles}
            experienceCount={experienceCount}
            limitReached={draftLimitReached}
          />
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

function DraftControls({
  question,
  index,
  draft,
  onRequestDraft,
  onApplyDraft,
  onCloseDraft,
  experienceTitles,
  experienceCount,
  limitReached,
}: {
  question: ApplicationQuestionDraft;
  index: number;
  draft: DraftUiState;
  onRequestDraft: (index: number, opts?: { retry: boolean }) => void;
  onApplyDraft: (index: number) => void;
  onCloseDraft: () => void;
  experienceTitles: Map<string, string>;
  experienceCount: number | null;
  limitReached: boolean;
}) {
  const result = draft?.status === "done" ? draft.result : null;
  const notice = result ? draftNotice(result) : null;
  const needsPrompt = question.prompt.trim().length === 0;
  const used = (question.draftExperienceIds ?? []).map((id) => experienceTitles.get(id)).filter(Boolean);
  const pointToExperiences = result?.kind === "no_experiences" || result?.kind === "needs_more";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {experienceCount === 0 ? (
          <Link href={EXPERIENCES_PATH} className="text-[13px] text-zinc-300 underline underline-offset-4 hover:text-zinc-100">
            {DRAFT.goExperiences}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onRequestDraft(index)}
            disabled={draft?.status === "loading" || needsPrompt || limitReached}
            className="h-9 rounded-lg border border-white/[0.12] px-3 text-[13px] text-zinc-100 hover:border-white/[0.24] disabled:opacity-50"
          >
            {DRAFT.button}
          </button>
        )}
        <span className="text-[12px] text-zinc-500">
          {experienceCount === 0
            ? DRAFT.noExperiences
            : limitReached && result?.kind !== "rate_limited"
              ? DRAFT.rateLimited
              : needsPrompt
                ? DRAFT.needPrompt
                : DRAFT.freeNote}
        </span>
        {used.length > 0 && (
          <span className="text-[12px] text-zinc-500">
            {DRAFT.usedLabel}: {used.join(", ")}
          </span>
        )}
      </div>
      {draft?.status === "loading" && (
        <p className="text-[13px] text-zinc-400" aria-live="polite">
          {DRAFT.generating}
        </p>
      )}
      {notice && (
        <p role="status" className="text-[13px] text-zinc-300">
          {notice}{" "}
          {pointToExperiences && (
            <Link href={EXPERIENCES_PATH} className="underline underline-offset-4 hover:text-zinc-100">
              {DRAFT.goExperiences}
            </Link>
          )}
        </p>
      )}
      {result?.kind === "ok" && (
        <DraftPreview
          draft={result}
          hasAnswer={question.answer.trim().length > 0}
          onApply={() => onApplyDraft(index)}
          onRetry={() => onRequestDraft(index, { retry: true })}
          onClose={onCloseDraft}
        />
      )}
    </div>
  );
}
