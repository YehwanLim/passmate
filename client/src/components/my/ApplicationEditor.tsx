import { Loader2, PenLine, Plus, Trash2 } from "lucide-react";
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
    <section className="rounded-[24px] bg-surface">
      <div className="flex items-center gap-5 overflow-x-auto border-b border-line-soft px-4 pt-4 sm:px-6">
        {questions.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={index === activeIndex ? "true" : undefined}
            className={`shrink-0 pb-3 pt-1 text-[14px] transition-colors ${
              index === activeIndex ? "font-bold text-ink shadow-[inset_0_-2px_0_#191f28]" : "font-medium text-ink-4 hover:text-ink-2"
            }`}
          >
            {WORKSPACE_COPY.questionLabel(index + 1)}
          </button>
        ))}
        {questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex shrink-0 items-center gap-1 pb-3 pt-1 text-[14px] text-ink-5 hover:text-ink-3"
          >
            <Plus className="h-3.5 w-3.5" /> {COPY.addQuestion}
          </button>
        )}
        <span
          className={`ml-auto shrink-0 pb-3 pl-3 text-[12.5px] ${failed ? "text-danger" : "text-ink-4"}`}
          role={failed ? "alert" : undefined}
          aria-live="polite"
        >
          {saveLabel(saveState)}
        </span>
      </div>

      {active && (
        <div className="space-y-4 p-4 sm:p-6">
          {/* 문항 원문은 길어서 한 줄 칸이면 폰에서 잘린다 — 줄바꿈되는 칸으로 두고, 폰에서는 글자 수 칸을 아래로 내린다 */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <textarea
              value={active.prompt}
              onChange={(e) => onChange(activeIndex, { prompt: e.target.value.replace(/\n/g, " ") })}
              placeholder={COPY.promptPlaceholder}
              maxLength={300}
              rows={2}
              className="min-w-0 basis-full resize-none rounded-xl border border-transparent bg-fill-soft px-4 py-3 text-[15px] leading-relaxed text-ink-2 placeholder:text-ink-5 focus:border-brand focus:bg-surface focus:outline-none sm:basis-auto sm:flex-1"
            />
            <input
              type="number"
              min={1}
              max={MAX_CHAR_LIMIT}
              value={active.charLimit ?? ""}
              onChange={(e) => onChange(activeIndex, { charLimit: parseCharLimit(e.target.value) })}
              aria-label={COPY.charLimitLabel}
              placeholder={COPY.charLimitLabel}
              className="w-28 rounded-xl border border-transparent bg-fill-soft px-3.5 py-3 text-[14px] text-ink-2 placeholder:text-ink-5 focus:border-brand focus:bg-surface focus:outline-none"
            />
            {questions.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(activeIndex)}
                aria-label={COPY.removeQuestion}
                className="rounded-xl px-2.5 text-ink-4 hover:bg-fill hover:text-danger"
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
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-4 text-[15px] leading-[1.8] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
          />
          <p className={`text-right text-[13px] ${over ? "font-semibold text-danger" : "text-ink-4"}`}>
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
          <Link href={EXPERIENCES_PATH} className="text-[14px] font-semibold text-brand-ink underline-offset-4 hover:underline">
            {DRAFT.goExperiences}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onRequestDraft(index)}
            disabled={draft?.status === "loading" || needsPrompt || limitReached}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-brand bg-surface px-3.5 text-[14px] font-semibold text-brand-ink transition-colors hover:bg-brand-soft disabled:border-line disabled:bg-surface disabled:text-ink-5"
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {DRAFT.button}
          </button>
        )}
        <span className="text-[13px] text-ink-4">
          {experienceCount === 0
            ? DRAFT.noExperiences
            : limitReached && result?.kind !== "rate_limited"
              ? DRAFT.rateLimited
              : needsPrompt
                ? DRAFT.needPrompt
                : DRAFT.freeNote}
        </span>
        {used.length > 0 && (
          <span className="text-[13px] text-ink-4">
            {DRAFT.usedLabel}: {used.join(", ")}
          </span>
        )}
      </div>
      {draft?.status === "loading" && (
        <p className="flex items-center gap-2 rounded-2xl bg-fill-soft px-4 py-3.5 text-[14px] text-ink-3" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-brand" aria-hidden="true" />
          {DRAFT.generating}
        </p>
      )}
      {notice && (
        <p role="status" className="text-[14px] text-ink-2">
          {notice}{" "}
          {pointToExperiences && (
            <Link href={EXPERIENCES_PATH} className="font-semibold text-brand-ink underline-offset-4 hover:underline">
              {DRAFT.goExperiences}
            </Link>
          )}
        </p>
      )}
      {result?.kind === "ok" && (
        <DraftPreview
          draft={result}
          hasAnswer={question.answer.trim().length > 0}
          canRetry={!limitReached}
          onApply={() => onApplyDraft(index)}
          onRetry={() => onRequestDraft(index, { retry: true })}
          onClose={onCloseDraft}
        />
      )}
    </div>
  );
}
