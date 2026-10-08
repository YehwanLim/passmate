import type { ReactNode } from "react";
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

/** 자동 저장 상태 글자. 편집기 위 막대(페이지)가 보여 준다. */
export function saveLabel(state: AutosaveState): string {
  if (state === "idle") return "";
  return WORKSPACE_COPY.save[state];
}

/**
 * 지원서 편집기(10-08 A안 · 자소설닷컴식): 원고지 왼쪽에 붙은 번호 탭(폰은 위쪽 가로) + 원고지
 * (머리말 · 문항 원문 · 글자 수 제한 · 초안 쓰기 · 답변 · 아래 글자 수와 막대). 저장 상태는 페이지 위 막대가 보여 준다.
 */
export default function ApplicationEditor({
  questions,
  activeIndex,
  onSelect,
  onChange,
  onAdd,
  onRemove,
  heading,
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
  /** 원고지 머리말(회사·직무·D-day) */
  heading?: ReactNode;
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
  const limit = active?.charLimit ?? null;
  const over = limit != null && counts.withSpaces > limit;
  const ratio = limit ? Math.min(1, counts.withSpaces / limit) : 0;

  const tab = (current: boolean) =>
    `flex h-10 w-11 shrink-0 items-center justify-center text-[15px] font-extrabold tabular-nums transition-colors rounded-t-[10px] sm:h-11 sm:rounded-l-[10px] sm:rounded-tr-none ${
      current ? "bg-brand text-white" : "bg-surface text-brand-ink hover:bg-brand-soft"
    }`;

  return (
    <div className="flex flex-col sm:flex-row sm:items-start">
      {/* 번호 탭: 넓은 화면은 원고지 왼쪽에 세로로 붙고, 폰은 위쪽에 가로로 붙는다 */}
      <div role="tablist" aria-label={COPY.questionsLabel} className="flex gap-1.5 overflow-x-auto pl-3 sm:flex-col sm:overflow-visible sm:pl-0 sm:pt-16">
        {questions.map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-label={WORKSPACE_COPY.questionLabel(index + 1)}
            aria-selected={index === activeIndex}
            aria-current={index === activeIndex ? "true" : undefined}
            onClick={() => onSelect(index)}
            className={tab(index === activeIndex)}
          >
            {index + 1}
          </button>
        ))}
        {questions.length < MAX_QUESTIONS && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={COPY.addQuestion}
            className="flex h-10 w-11 shrink-0 items-center justify-center rounded-t-[10px] bg-fill text-ink-3 transition-colors hover:bg-line sm:h-11 sm:rounded-l-[10px] sm:rounded-tr-none"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {active && (
        <section className="flex min-h-[620px] min-w-0 flex-1 flex-col rounded-[18px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          {heading && <div className="flex items-center justify-between gap-3 border-b border-dashed border-line px-5 py-4 sm:px-7">{heading}</div>}

          <div className="space-y-3 px-5 pt-5 sm:px-7">
            {/* 문항 원문은 길어서 한 줄 칸이면 폰에서 잘린다 — 줄바꿈되는 칸 */}
            <textarea
              value={active.prompt}
              onChange={(e) => onChange(activeIndex, { prompt: e.target.value.replace(/\n/g, " ") })}
              placeholder={COPY.promptPlaceholder}
              aria-label={COPY.promptLabel}
              maxLength={300}
              rows={2}
              className="w-full resize-none rounded-xl border border-transparent bg-transparent px-1 py-1 text-[16px] font-semibold leading-[1.6] text-ink placeholder:font-medium placeholder:text-ink-5 hover:bg-fill-soft focus:border-brand focus:bg-surface focus:outline-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
              <label className="inline-flex items-center gap-1.5 rounded-lg bg-fill px-2.5 py-1 text-[12.5px] font-semibold text-ink-3">
                {COPY.charLimitLabel}
                <input
                  type="number"
                  min={1}
                  max={MAX_CHAR_LIMIT}
                  value={active.charLimit ?? ""}
                  onChange={(e) => onChange(activeIndex, { charLimit: parseCharLimit(e.target.value) })}
                  aria-label={COPY.charLimitLabel}
                  placeholder={COPY.noLimit}
                  className="w-16 rounded-md border border-transparent bg-surface px-1.5 py-0.5 text-right text-[12.5px] tabular-nums text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
                />
                자
              </label>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(activeIndex)}
                  aria-label={COPY.removeQuestion}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-ink-4 hover:bg-fill hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {COPY.removeQuestion}
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-line-soft px-5 pt-4 sm:px-7">
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
          </div>

          {/* 답변 — 원고지처럼 테두리 없이 넓게 */}
          <textarea
            value={active.answer}
            onChange={(e) => onChange(activeIndex, { answer: e.target.value })}
            placeholder={COPY.answerPlaceholder}
            aria-label={COPY.answerLabel}
            maxLength={6000}
            className="min-h-[360px] w-full flex-1 resize-y border-0 bg-transparent px-5 py-4 text-[15.5px] leading-[1.9] text-ink placeholder:text-ink-5 focus:outline-none sm:px-7"
          />

          {/* 아래: 큰 글자 수 + 막대(제한이 있을 때) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-soft px-5 py-3.5 sm:px-7">
            <p className={`text-[20px] font-extrabold tabular-nums ${over ? "text-danger" : "text-ink"}`}>
              {counts.withSpaces.toLocaleString()}
              <span className="ml-1 text-[15px] font-semibold text-ink-4">/ {limit != null ? limit.toLocaleString() : "—"}</span>
            </p>
            <p className={`text-[12.5px] ${over ? "font-semibold text-danger" : "text-ink-4"}`}>
              {COPY.charCount(counts.withSpaces, counts.withoutSpaces)}
              {over && ` · ${COPY.overLimit}`}
            </p>
            {limit != null && (
              <div className="h-2 min-w-[120px] flex-1 rounded-full bg-fill" aria-hidden="true">
                <div className={`h-2 rounded-full ${over ? "bg-danger" : "bg-brand"}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
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
