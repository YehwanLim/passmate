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
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.experiences;
const field = "w-full rounded-lg border border-white/[0.08] bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600";
const EMPTY: ExperienceInput = { title: "", period: null, situation: "", action: "", result: "", tags: [] };

// 서버 한도(태그 5개·태그당 20자)에 맞춰 보내야 400을 받지 않는다.
function parseTags(raw: string): string[] {
  const tags = raw.split(",").map((t) => t.trim().slice(0, 20)).filter(Boolean);
  return Array.from(new Set(tags)).slice(0, 5);
}

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
    <label className="block space-y-1 text-[13px] text-zinc-400">
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
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <label className="block space-y-1 text-[13px] text-zinc-400">
          <span>{COPY.fields.title}</span>
          <input aria-label={COPY.fields.title} placeholder={COPY.fields.titlePlaceholder} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={100} className={field} />
        </label>
        <label className="block space-y-1 text-[13px] text-zinc-400">
          <span>{COPY.fields.period}</span>
          <input aria-label={COPY.fields.period} value={draft.period ?? ""} onChange={(e) => setDraft({ ...draft, period: e.target.value })} maxLength={50} className={field} />
        </label>
      </div>
      {text("situation")}
      {text("action")}
      {text("result")}
      <label className="block space-y-1 text-[13px] text-zinc-400">
        <span>{COPY.fields.tags}</span>
        <input aria-label={COPY.fields.tags} value={tagText} onChange={(e) => setTagText(e.target.value)} className={field} />
      </label>
      {error && <p role="alert" className="text-[13px] text-red-400">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-xl px-4 text-sm text-zinc-400">{COPY.cancel}</button>
        <button type="submit" disabled={busy} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black disabled:opacity-50">{COPY.save}</button>
      </div>
    </form>
  );
}

export default function ExperienceVault() {
  const [items, setItems] = useState<Experience[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  if (loadError) return <p role="alert" className="py-10 text-center text-sm text-red-400">{loadError}</p>;
  if (!items) return <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />;

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
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={() => setEditing("new")} className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black">
            {COPY.add}
          </button>
        </div>
      )}

      {deleteError && <p role="alert" className="text-[13px] text-red-400">{deleteError}</p>}

      {items.length === 0 && editing !== "new" && <p className="py-10 text-center text-[13px] text-zinc-500">{COPY.empty}</p>}

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
          <article key={item.id} className="space-y-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-zinc-100">{item.title}</h3>
                {item.period && <p className="text-[12px] text-zinc-500">{item.period}</p>}
              </div>
              <div className="flex shrink-0 gap-2 text-[12px]">
                <button type="button" aria-label={`${item.title} ${COPY.edit}`} onClick={() => setEditing(item.id)} className="text-zinc-400 hover:text-zinc-200">{COPY.edit}</button>
                <button type="button" aria-label={`${item.title} ${COPY.remove}`} onClick={() => remove(item)} className="text-zinc-500 hover:text-zinc-300">
                  {COPY.remove}
                </button>
              </div>
            </div>
            {item.situation && <p className="text-[13px] text-zinc-400">{item.situation}</p>}
            {item.action && <p className="text-[13px] text-zinc-300">{item.action}</p>}
            {item.result && <p className="text-[13px] text-zinc-200">{item.result}</p>}
            {item.tags.length > 0 && <p className="text-[12px] text-zinc-500">{item.tags.join(" · ")}</p>}
          </article>
        )
      )}
    </div>
  );
}
