import { useState } from "react";
import { createApplication, WorkspaceApiError } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.newApplicationForm;
const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";

export default function NewApplicationForm({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [company, setCompany] = useState("");
  const [jobKeyword, setJobKeyword] = useState("");
  const [deadline, setDeadline] = useState("");
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!company.trim()) {
      setError(COPY.companyRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { id } = await createApplication({
        company: company.trim(),
        ...(jobKeyword.trim() ? { jobKeyword: jobKeyword.trim() } : {}),
        // <input type="date"> 는 날짜만 준다. 마감은 그날 23:59 KST 로 본다.
        deadline: deadline ? `${deadline}T23:59:00+09:00` : null,
        questions: prompts.filter((p) => p.trim()).map((prompt) => ({ prompt: prompt.trim(), charLimit: null, answer: "" })),
      });
      onCreated(id);
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError && caught.code === "PROJECT_LIMIT_REACHED" ? COPY.limitReached : COPY.createFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-fill-soft p-5">
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{COPY.company}</span>
        <input aria-label={COPY.company} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} className={field} />
      </label>
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{COPY.job}</span>
        <input aria-label={COPY.job} value={jobKeyword} onChange={(e) => setJobKeyword(e.target.value)} maxLength={100} className={field} />
      </label>
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{COPY.deadline}</span>
        <input aria-label={COPY.deadline} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
      </label>
      {prompts.map((prompt, index) => (
        <label key={index} className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
          <span>{WORKSPACE_COPY.questionLabel(index + 1)}</span>
          <input
            aria-label={WORKSPACE_COPY.questionLabel(index + 1)}
            value={prompt}
            onChange={(e) => setPrompts((current) => current.map((p, i) => (i === index ? e.target.value : p)))}
            maxLength={300}
            placeholder={WORKSPACE_COPY.editor.promptPlaceholder}
            className={field}
          />
        </label>
      ))}
      {prompts.length < 5 && (
        <button type="button" onClick={() => setPrompts((c) => [...c, ""])} className="text-[13px] font-semibold text-brand-ink hover:text-brand">
          + {WORKSPACE_COPY.editor.addQuestion}
        </button>
      )}
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-[10px] px-4 text-[14px] font-semibold text-ink-3 hover:bg-fill">{COPY.cancel}</button>
        <button type="submit" disabled={busy} className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50">{COPY.submit}</button>
      </div>
    </form>
  );
}
