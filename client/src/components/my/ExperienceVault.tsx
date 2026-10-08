import { useEffect, useState } from "react";
import {
  createExperience,
  deleteExperience,
  listExperiences,
  updateExperience,
  WorkspaceApiError,
  type Experience,
  type ExperienceInput,
} from "@/lib/workspace";
import { parseTags } from "@/lib/experienceImport";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";
import ExperienceImportDialog from "./ExperienceImportDialog";

const COPY = WORKSPACE_COPY.experiences;
const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";
const EMPTY: ExperienceInput = { title: "", period: null, situation: "", action: "", result: "", tags: [] };

function ExperienceForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: ExperienceInput;
  onSubmit: (input: ExperienceInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [tagText, setTagText] = useState(initial.tags.join(", "));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError(COPY.titleRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...draft, title: draft.title.trim(), period: draft.period?.trim() || null, tags: parseTags(tagText) });
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError && caught.code === "EXPERIENCE_LIMIT_REACHED" ? COPY.limitReached : COPY.saveFailed);
      setBusy(false);
    }
  };

  const text = (key: "situation" | "action" | "result") => (
    <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
      <span>{COPY.fields[key]}</span>
      <textarea
        aria-label={COPY.fields[key]}
        value={draft[key]}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        maxLength={1500}
        rows={3}
        className={field}
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-fill-soft p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
          <span>{COPY.fields.title}</span>
          <input aria-label={COPY.fields.title} placeholder={COPY.fields.titlePlaceholder} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={100} className={field} />
        </label>
        <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
          <span>{COPY.fields.period}</span>
          <input aria-label={COPY.fields.period} value={draft.period ?? ""} onChange={(e) => setDraft({ ...draft, period: e.target.value })} maxLength={50} className={field} />
        </label>
      </div>
      {text("situation")}
      {text("action")}
      {text("result")}
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{COPY.fields.tags}</span>
        <input aria-label={COPY.fields.tags} value={tagText} onChange={(e) => setTagText(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-[10px] px-4 text-[14px] font-semibold text-ink-3 hover:bg-fill">{COPY.cancel}</button>
        <button type="submit" disabled={busy} className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50">{COPY.save}</button>
      </div>
    </form>
  );
}

export default function ExperienceVault() {
  const [items, setItems] = useState<Experience[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    listExperiences()
      .then(setItems)
      .catch(() => setLoadError(COPY.loadError));
  }, []);

  const remove = async (item: Experience) => {
    if (!window.confirm(COPY.confirmRemove(item.title))) return;
    setDeleteError(null);
    try {
      await deleteExperience(item.id);
      setItems((current) => (current ?? []).filter((e) => e.id !== item.id));
    } catch {
      setDeleteError(COPY.deleteFailed);
    }
  };

  if (loadError) return <p role="alert" className="py-10 text-center text-sm text-danger">{loadError}</p>;
  if (!items) return <div className="h-24 animate-pulse rounded-2xl bg-fill" />;

  return (
    <div className="space-y-4">
      {editing === "new" ? (
        <ExperienceForm
          initial={EMPTY}
          onCancel={() => setEditing(null)}
          onSubmit={async (input) => {
            const created = await createExperience(input);
            setItems((current) => [created, ...(current ?? [])]);
            setEditing(null);
          }}
        />
      ) : items.length > 0 ? (
        // 비어 있을 때는 가운데 안내에 같은 버튼이 있으니 위 줄은 숨긴다(두 번 보이지 않게).
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="h-10 rounded-[10px] border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft"
          >
            {COPY.import.open}
          </button>
          <button type="button" onClick={() => setEditing("new")} className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover">
            {COPY.add}
          </button>
        </div>
      ) : null}

      {deleteError && <p role="alert" className="text-[13px] text-danger">{deleteError}</p>}

      {items.length === 0 && editing !== "new" && (
        <div className="py-12 text-center">
          <p className="text-[14px] leading-relaxed text-ink-4">{COPY.empty}</p>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="mt-5 h-12 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
          >
            {COPY.import.open}
          </button>
          <div>
            <button type="button" onClick={() => setEditing("new")} className="mt-3 h-10 rounded-[10px] px-4 text-[14px] font-semibold text-ink-3 transition-colors hover:bg-fill">
              {COPY.addManually}
            </button>
          </div>
        </div>
      )}

      {items.map((item) =>
        editing === item.id ? (
          <ExperienceForm
            key={item.id}
            initial={{ title: item.title, period: item.period, situation: item.situation, action: item.action, result: item.result, tags: item.tags }}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const updated = await updateExperience(item.id, input);
              setItems((current) => (current ?? []).map((e) => (e.id === item.id ? updated : e)));
              setEditing(null);
            }}
          />
        ) : (
          <article key={item.id} className="space-y-2 rounded-2xl bg-fill-soft p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold text-ink">{item.title}</h3>
                {item.period && <p className="mt-0.5 text-[13px] text-ink-4">{item.period}</p>}
              </div>
              <div className="flex shrink-0 gap-1 text-[13px]">
                <button type="button" aria-label={`${item.title} ${COPY.edit}`} onClick={() => setEditing(item.id)} className="rounded-lg px-2 py-1 font-semibold text-ink-3 hover:bg-fill">{COPY.edit}</button>
                <button type="button" aria-label={`${item.title} ${COPY.remove}`} onClick={() => remove(item)} className="rounded-lg px-2 py-1 text-ink-4 hover:bg-fill hover:text-danger">
                  {COPY.remove}
                </button>
              </div>
            </div>
            {item.situation && <p className="text-[14px] leading-relaxed text-ink-3">{item.situation}</p>}
            {item.action && <p className="text-[14px] leading-relaxed text-ink-2">{item.action}</p>}
            {item.result && <p className="text-[14px] leading-relaxed text-ink">{item.result}</p>}
            {item.tags.length > 0 && <p className="text-[13px] text-ink-4">{item.tags.join(" · ")}</p>}
          </article>
        )
      )}
      <ExperienceImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        existingTitles={items.map((item) => item.title)}
        ownedCount={items.length}
        onSaved={(created) => setItems((current) => [...created, ...(current ?? [])])}
      />
    </div>
  );
}
