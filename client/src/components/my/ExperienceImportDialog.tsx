import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, FileUp, Loader2 } from "lucide-react";

import {
  EXPERIENCE_PER_USER,
  EXTRACT_TEXT_MAX,
  EXTRACT_TEXT_MIN,
  isSimilarTitle,
  parseTags,
  requestExperienceCandidates,
  type ExperienceCandidate,
} from "@/lib/experienceImport";
import { extractTextFromFile, ResumeImportError } from "@/lib/resumeFileImport";
import { createExperiences, WorkspaceApiError, type Experience, type ExperienceInput } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/copy/workspaceCopy";
import ExperienceCandidateCard, { type EditableCandidate } from "./ExperienceCandidateCard";

const COPY = WORKSPACE_COPY.experiences.import;

function toEditable(candidates: ExperienceCandidate[], existingTitles: string[]): EditableCandidate[] {
  return candidates.map((c, i) => {
    const similar = existingTitles.some((title) => isSimilarTitle(title, c.title));
    return { ...c, key: `${i}-${c.title}`, selected: !similar, similar, tagText: c.tags.join(", ") };
  });
}

function toInput(c: EditableCandidate): ExperienceInput {
  return {
    title: c.title.trim(),
    period: c.period.trim() || null,
    situation: c.situation,
    action: c.action,
    result: c.result,
    tags: parseTags(c.tagText),
  };
}

/**
 * 이력서·자소서 → 경험 후보 → 골라 저장. 금고(ExperienceVault)가 연다.
 * 리포트 끝 카드처럼 글을 이미 가진 곳은 initialText 를 넘긴다 — 붙여넣기 없이 열리자마자 한 번 뽑는다.
 */
export default function ExperienceImportDialog({
  open,
  onClose,
  existingTitles,
  ownedCount,
  onSaved,
  initialText,
}: {
  open: boolean;
  onClose: () => void;
  existingTitles: string[];
  ownedCount: number;
  onSaved: (created: Experience[]) => void;
  initialText?: string;
}) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<"input" | "loading" | "review">("input");
  const [items, setItems] = useState<EditableCandidate[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 열릴 때마다 한 번만 자동으로 뽑는다(StrictMode 의 이중 effect 로 두 번 차감되지 않게). 닫히면 다시 켠다.
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!open) {
      autoStarted.current = false;
      return;
    }
    if (!initialText || autoStarted.current) return;
    autoStarted.current = true;
    setText(initialText);
    void extract(initialText);
    // extract 는 매 렌더 새로 만들어지지만 열림 한 번에 한 번만 부르면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialText]);

  if (!open) return null;

  const length = text.trim().length;
  const canExtract = length >= EXTRACT_TEXT_MIN && length <= EXTRACT_TEXT_MAX && !reading;
  const selected = items.filter((item) => item.selected);
  const available = Math.max(0, EXPERIENCE_PER_USER - ownedCount);

  const close = () => {
    setText("");
    setItems([]);
    setStep("input");
    setMessage(null);
    setShowHelp(false);
    onClose();
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    setMessage(null);
    try {
      setText((await extractTextFromFile(file)).slice(0, EXTRACT_TEXT_MAX));
    } catch (caught) {
      setMessage(caught instanceof ResumeImportError ? caught.message : COPY.fileFailed);
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const extract = async (source: string = text) => {
    setStep("loading");
    setMessage(null);
    const result = await requestExperienceCandidates(source);
    if (result.kind === "ok") {
      setItems(toEditable(result.candidates, existingTitles));
      setRemaining(result.remainingToday);
      setStep("review");
      return;
    }
    setStep("input");
    if (result.kind === "empty") {
      setRemaining(result.remainingToday);
      setMessage(COPY.empty);
    } else if (result.kind === "rate_limited") setMessage(COPY.rateLimited);
    else if (result.kind === "limit_reached") setMessage(COPY.full(available));
    else if (result.kind === "invalid") setMessage(COPY.tooShort);
    else if (result.kind === "network") setMessage(COPY.network);
    else setMessage(COPY.failed);
  };

  const save = async () => {
    if (selected.some((item) => !item.title.trim())) {
      setMessage(COPY.titleRequired);
      return;
    }
    if (selected.length > available) {
      setMessage(COPY.full(available));
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const created = await createExperiences(selected.map(toInput));
      onSaved(created);
      close();
    } catch (caught) {
      setMessage(caught instanceof WorkspaceApiError && caught.code === "EXPERIENCE_LIMIT_REACHED" ? COPY.full(available) : COPY.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-stretch justify-center bg-ink/40 sm:items-center sm:p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={COPY.title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col bg-surface sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-5 sm:px-8">
          <div>
            <h2 className="text-[18px] font-bold text-ink">{COPY.title}</h2>
            {/* 두 문장을 줄마다 나눠, 폰에서도 단어 중간에서 끊기지 않게 */}
            <p className="mt-1 text-[14px] leading-relaxed text-ink-4 break-keep">
              {step === "review" ? COPY.found(items.length) : COPY.intro.map((line) => <span key={line} className="block">{line}</span>)}
            </p>
          </div>
          <button type="button" onClick={close} className="shrink-0 rounded-lg px-2 py-1 text-[14px] font-semibold text-ink-3 hover:bg-fill">
            {COPY.close}
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-8">
          {step === "review" ? (
            items.map((item) => (
              <ExperienceCandidateCard
                key={item.key}
                item={item}
                onChange={(next) => setItems((current) => current.map((c) => (c.key === next.key ? next : c)))}
              />
            ))
          ) : step === "loading" ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-3" aria-live="polite">
              <Loader2 className="size-7 animate-spin text-brand" aria-hidden="true" />
              <p className="text-[15px] font-semibold">{COPY.extracting}</p>
            </div>
          ) : (
            <>
              <textarea
                aria-label={COPY.inputLabel}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, EXTRACT_TEXT_MAX))}
                placeholder={COPY.placeholder}
                rows={8}
                className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-[1.8] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={reading}
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 hover:bg-fill-soft disabled:cursor-wait"
                  >
                    {reading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}
                    {reading ? COPY.reading : COPY.upload}
                  </button>
                  {/* 예시는 길어서 접어 두고, 궁금할 때만 펼친다 */}
                  <button
                    type="button"
                    aria-expanded={showHelp}
                    onClick={() => setShowHelp((v) => !v)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[10px] px-3 text-[14px] font-semibold text-ink-3 hover:bg-fill"
                  >
                    <CircleHelp className="size-4" aria-hidden="true" />
                    {showHelp ? COPY.example.hide : COPY.example.show}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  aria-label={COPY.upload}
                  onChange={(e) => void readFile(e.target.files?.[0])}
                />
                <span className="text-[13px] tabular-nums text-ink-4">{COPY.chars(length)}</span>
              </div>
              {showHelp && <ImportExample />}
            </>
          )}
          {message && <p role="alert" className="text-[14px] leading-relaxed text-danger">{message}</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-4 sm:px-8">
          <p className="text-[13px] text-ink-4">{remaining === null ? COPY.quota : COPY.remaining(remaining)}</p>
          {step === "review" ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep("input")} className="h-11 rounded-xl px-4 text-[15px] font-semibold text-ink-3 hover:bg-fill">
                {COPY.back}
              </button>
              <button
                type="button"
                disabled={selected.length === 0 || saving}
                onClick={() => void save()}
                className="h-11 rounded-xl bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
              >
                {COPY.save(selected.length)}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!canExtract || step === "loading"}
              onClick={() => void extract()}
              className="h-11 rounded-xl bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-hover disabled:opacity-40"
            >
              {COPY.extract}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type Mark = keyof typeof COPY.example.legend;

// 원문 조각과 카드 칸이 같은 색을 써서 어느 문장이 어디로 갔는지 보이게 한다.
const MARK_TONE: Record<Mark, string> = {
  s: "bg-brand-soft text-brand-ink",
  a: "bg-ok-soft text-ok",
  r: "bg-violet-50 text-violet-700",
  x: "text-ink-5 line-through decoration-ink-5/60",
};

/** 빈 입력칸 아래 고정 예시: 이력서·자소서를 넣으면 무엇이 어떻게 뽑히는지. 모델을 부르지 않아 횟수를 쓰지 않는다. */
function ImportExample() {
  const example = COPY.example;
  const [tabKey, setTabKey] = useState<string>(example.tabs[0].key);
  const tab = example.tabs.find((t) => t.key === tabKey) ?? example.tabs[0];

  return (
    <section aria-label={example.label} className="space-y-3 rounded-2xl border border-line-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink-4">{example.label}</p>
        <div role="tablist" aria-label={example.label} className="inline-flex rounded-lg bg-fill p-0.5">
          {example.tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab.key}
              onClick={() => setTabKey(t.key)}
              className={`h-8 rounded-md px-3 text-[13px] font-semibold ${t.key === tab.key ? "bg-surface text-ink shadow-sm" : "text-ink-4 hover:text-ink-2"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-fill-soft px-3.5 py-3 text-[13px] leading-[1.9] text-ink-3">
        {"question" in tab && <p className="mb-1 text-[12.5px] font-semibold text-ink-4">{tab.question}</p>}
        {tab.source.map((line, i) => (
          <p key={i}>
            {line.map(([text, mark], j) =>
              mark === "h" ? (
                <span key={j} className="font-semibold text-ink-2">
                  {text}
                </span>
              ) : mark ? (
                <span key={j} className={`box-decoration-clone rounded px-0.5 ${MARK_TONE[mark as Mark]}`}>
                  {text}
                </span>
              ) : (
                <span key={j}>{text}</span>
              ),
            )}
          </p>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-4">
        <span className="font-semibold">↓ {example.flow}</span>
        {(Object.keys(example.legend) as Mark[]).map((mark) => (
          <span key={mark} className={`rounded px-1.5 py-0.5 font-semibold ${MARK_TONE[mark]}`}>
            {example.legend[mark]}
          </span>
        ))}
      </div>

      <div className={`grid gap-2 ${tab.cards.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {tab.cards.map((card) => (
          <div key={card.title} className="space-y-2 rounded-xl border border-line px-3.5 py-3">
            <div>
              <p className="text-[14px] font-bold leading-snug text-ink">{card.title}</p>
              <p className="text-[12px] text-ink-5">{card.period}</p>
            </div>
            {card.rows.map(([mark, value]) => (
              <div key={mark} className="grid grid-cols-[3.25rem_1fr] items-start gap-2 text-[13px] leading-relaxed text-ink-3">
                <span className={`rounded px-1.5 py-0.5 text-center text-[12px] font-semibold ${MARK_TONE[mark as Mark]}`}>
                  {example.legend[mark as Mark]}
                </span>
                {value ? (
                  <span>{value}</span>
                ) : (
                  <span>
                    <span className="rounded bg-blank-soft px-1.5 py-0.5 text-[12px] font-semibold text-blank">{COPY.blank}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <ul className="space-y-1 text-[13px] leading-relaxed text-ink-3">
        {[tab.summary, example.blankNote].map((note) => (
          <li key={note} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-ink-4" aria-hidden="true" />
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}
