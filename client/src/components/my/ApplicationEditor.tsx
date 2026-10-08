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

/** 자동 저장 상태 글자. 편집기 위 막대(페이지)가 보여 준다. */
export function saveLabel(state: AutosaveState): string {
  if (state === "idle") return "";
  return WORKSPACE_COPY.save[state];
}

/**
 * 지원서 편집기(10-08 A안 · 자소설닷컴식): 원고지 왼쪽에 붙은 번호 탭(폰은 위쪽 가로) + 원고지
 * (머리말 · 문항 원문 · 글자 수 · 초안 쓰기 · 답변). 저장 상태는 페이지 위 막대가 보여 준다.
 * 글자 수 제한 칸은 10-09 뺐다 — 쓰는 사람이 알아서 맞춘다. 예전에 저장한 제한 값은 그대로 두고 화면에만 안 보인다.
 * 글자 수는 원고지 맨 아래에 두면 화면 밖으로 밀려 안 보여서, 제한 칸이 있던 문항 원문 아래로 올렸다.
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
  showDraft = true,
  answerPlaceholder = COPY.answerPlaceholder,
  fitHeightClassName,
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
  /** 저장된 지원서가 있어야 초안을 쓸 수 있다 — 자소서 분석(/analyze) 화면은 끈다. */
  showDraft?: boolean;
  answerPlaceholder?: string;
  /**
   * 넓은 화면에서 원고지를 한 화면 높이에 맞추는 높이 클래스(페이지마다 위아래 막대 높이가 달라 페이지가 정한다).
   * 주면 문항 원문은 늘 보이고 답변만 칸 안에서 스크롤된다(10-09). 안 주면 예전처럼 글 길이만큼 늘어난다.
   */
  fitHeightClassName?: string;
}) {
  const active = questions[activeIndex];
  const counts = countChars(active?.answer ?? "");

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
        <section
          className={`flex min-h-[620px] min-w-0 flex-1 flex-col rounded-[18px] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${
            fitHeightClassName ? `lg:min-h-[440px] lg:overflow-hidden ${fitHeightClassName}` : ""
          }`}
        >
          {heading && <div className="flex items-center justify-between gap-3 border-b border-dashed border-line px-5 py-4 sm:px-7">{heading}</div>}

          <div className="space-y-3 px-5 pt-5 sm:px-7">
            {/* 문항 원문(길어서 폰에서 잘리지 않게 줄바꿈되는 칸) + 오른쪽 위 구석에 문항 삭제 */}
            <div className="flex items-start gap-2">
              <textarea
                value={active.prompt}
                onChange={(e) => onChange(activeIndex, { prompt: e.target.value.replace(/\n/g, " ") })}
                placeholder={COPY.promptPlaceholder}
                aria-label={COPY.promptLabel}
                maxLength={300}
                rows={2}
                className="min-w-0 flex-1 resize-none rounded-xl border border-transparent bg-transparent px-1 py-1 text-[16px] font-semibold leading-[1.6] text-ink placeholder:font-medium placeholder:text-ink-5 hover:bg-fill-soft focus:border-brand focus:bg-surface focus:outline-none"
              />
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(activeIndex)}
                  aria-label={COPY.removeQuestion}
                  className="-mr-2 -mt-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-ink-4 hover:bg-fill hover:text-danger sm:-mr-4"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {COPY.removeQuestion}
                </button>
              )}
            </div>
            <div className="pb-4">
              <p className="inline-block rounded-lg bg-fill px-2.5 py-1 text-[12.5px] font-semibold tabular-nums text-ink-3">{COPY.charCount(counts.withSpaces, counts.withoutSpaces)}</p>
            </div>
          </div>

          {showDraft && (
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
          )}

          {/* 답변 — 원고지처럼 테두리 없이 넓게 */}
          <textarea
            value={active.answer}
            onChange={(e) => onChange(activeIndex, { answer: e.target.value })}
            placeholder={answerPlaceholder}
            aria-label={COPY.answerLabel}
            maxLength={6000}
            className={`min-h-[360px] w-full flex-1 resize-y border-0 bg-transparent px-5 py-4 ${showDraft ? "" : "border-t border-line-soft"} ${
              fitHeightClassName ? "lg:min-h-[160px] lg:resize-none lg:overflow-y-auto" : ""
            } text-[14.5px] leading-[1.8] text-ink placeholder:text-ink-5 focus:outline-none sm:px-7`}
          />
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
