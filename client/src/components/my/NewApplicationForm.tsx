import { useState } from "react";
import { createApplication, WorkspaceApiError } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.newApplicationForm;
const field = "w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600";

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
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{COPY.company}</span>
        <input aria-label={COPY.company} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} className={field} />
      </label>
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{COPY.job}</span>
        <input aria-label={COPY.job} value={jobKeyword} onChange={(e) => setJobKeyword(e.target.value)} maxLength={100} className={field} />
      </label>
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{COPY.deadline}</span>
        <input aria-label={COPY.deadline} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
      </label>
      {prompts.map((prompt, index) => (
        <label key={index} className="block space-y-1 text-[13px] text-zinc-400">
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
        <button type="button" onClick={() => setPrompts((c) => [...c, ""])} className="text-[13px] text-zinc-400 hover:text-zinc-200">
          + {WORKSPACE_COPY.editor.addQuestion}
        </button>
      )}
      {error && <p role="alert" className="text-[13px] text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm text-zinc-400">{COPY.cancel}</button>
        <button type="submit" disabled={busy} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">{COPY.submit}</button>
      </div>
    </form>
  );
}
