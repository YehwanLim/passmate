import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

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
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";
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

/** 이력서·자소서 → 경험 후보 → 골라 저장. 금고(ExperienceVault)가 연다. */
export default function ExperienceImportDialog({
  open,
  onClose,
  existingTitles,
  ownedCount,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  existingTitles: string[];
  ownedCount: number;
  onSaved: (created: Experience[]) => void;
}) {
  const [text, setText] = useState("");
  const [step, setStep] = useState<"input" | "loading" | "review">("input");
  const [items, setItems] = useState<EditableCandidate[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const extract = async () => {
    setStep("loading");
    setMessage(null);
    const result = await requestExperienceCandidates(text);
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
            <p className="mt-1 text-[14px] leading-relaxed text-ink-4">{step === "review" ? COPY.found(items.length) : COPY.intro}</p>
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
                <button
                  type="button"
                  disabled={reading}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 hover:bg-fill-soft disabled:cursor-wait"
                >
                  {reading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <FileUp className="size-4" aria-hidden="true" />}
                  {reading ? COPY.reading : COPY.upload}
                </button>
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
              {length === 0 && <ImportExample />}
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

/** 빈 입력칸 아래 고정 예시: 무엇을 넣으면 무엇이 나오는지. 모델을 부르지 않아 횟수를 쓰지 않는다. */
function ImportExample() {
  const example = COPY.example;
  return (
    <section aria-label={example.label} className="rounded-2xl border border-line-soft p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-semibold text-ink-4">
            {example.label} · {example.input}
          </p>
          <div className="mt-2 space-y-1 rounded-xl bg-fill-soft px-3.5 py-3 text-[13px] leading-relaxed text-ink-3">
            {example.source.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink-4">{example.output}</p>
          <div className="mt-2 space-y-2 rounded-xl border border-line px-3.5 py-3">
            <p className="text-[14px] font-bold text-ink">
              {example.title}
              <span className="ml-2 text-[12px] font-medium text-ink-5">{example.period}</span>
            </p>
            {example.rows.map(([label, value]) => (
              <p key={label} className="text-[13px] leading-relaxed text-ink-3">
                <span className="mr-1.5 font-semibold text-ink-4">{label}</span>
                {value}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
