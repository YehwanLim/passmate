import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Search, X } from "lucide-react";
import {
  createExperience,
  deleteExperience,
  formatPeriod,
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
const label = "block space-y-1.5 text-[13px] font-semibold text-ink-4";
const EMPTY: ExperienceInput = { title: "", period: null, situation: "", action: "", result: "", body: "", tags: [] };
const SECTIONS = ["situation", "action", "result"] as const;
/** 위 거르기 줄에 먼저 꺼내 두는 키워드 수. 나머지는 "더 보기"로 접는다. */
const TOP_KEYWORDS = 5;

function Capsule({ children, small = false }: { children: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full bg-fill font-semibold text-ink-3 ${small ? "h-[22px] px-2 text-[11.5px]" : "h-[26px] px-2.5 text-[12.5px]"}`}>
      {children}
    </span>
  );
}

/** 키워드 입력: 캡슐로 쌓고 Enter·쉼표로 더한다. 최대 5개·20자(parseTags 와 같은 규칙). */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    if (!text.trim()) return;
    onChange(parseTags([...tags, text].join(",")));
    setText("");
  };
  return (
    <div className="flex min-h-[46px] flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-2 focus-within:border-brand">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex h-[26px] items-center gap-1 rounded-full bg-fill pl-2.5 pr-1.5 text-[12.5px] font-semibold text-ink-3">
          {tag}
          <button type="button" aria-label={COPY.tagRemove(tag)} onClick={() => onChange(tags.filter((t) => t !== tag))} className="rounded-full p-0.5 text-ink-5 hover:text-ink-2">
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      {tags.length < 5 && (
        <input
          aria-label={COPY.fields.tags}
          value={text}
          placeholder={COPY.tagPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter 는 글자 확정용
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            } else if (e.key === "Backspace" && !text && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={add}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-[14px] text-ink placeholder:text-ink-5 focus:outline-none"
        />
      )}
    </div>
  );
}

type WriteMode = "free" | "fields";

/** 기존 경험은 쓴 방식대로 연다: 자유 글이 있거나 칸이 다 비었으면 자유 양식, 칸만 채웠으면 칸. */
function modeOf(input: ExperienceInput): WriteMode {
  if (input.body?.trim()) return "free";
  return SECTIONS.some((key) => input[key].trim()) ? "fields" : "free";
}

function ExperienceForm({
  heading,
  initial,
  onSubmit,
  onCancel,
}: {
  heading: string;
  initial: ExperienceInput;
  onSubmit: (input: ExperienceInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ExperienceInput>({ ...initial, body: initial.body ?? "" });
  const [mode, setMode] = useState<WriteMode>(() => modeOf(initial));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 방식을 바꿔도 쓴 글은 잃지 않는다: 칸 → 자유는 채운 칸을 줄바꿈으로 잇고, 자유 → 칸은 글을 "내가 한 일"에 옮긴다.
  const switchMode = (next: WriteMode) => {
    if (next === mode) return;
    if (next === "free") {
      const joined = SECTIONS.map((key) => draft[key].trim()).filter(Boolean).join("\n\n");
      setDraft({ ...draft, body: draft.body?.trim() ? draft.body : joined, situation: "", action: "", result: "" });
    } else {
      const body = draft.body?.trim() ?? "";
      const empty = SECTIONS.every((key) => !draft[key].trim());
      setDraft({ ...draft, action: empty && body ? body : draft.action, body: "" });
    }
    setMode(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError(COPY.titleRequired);
      return;
    }
    setBusy(true);
    setError(null);
    // 한 경험은 한 가지 방식으로만 저장한다(자유 글이면 칸은 비우고, 칸이면 자유 글은 비운다).
    const content =
      mode === "free"
        ? { body: draft.body ?? "", situation: "", action: "", result: "" }
        : { body: "", situation: draft.situation, action: draft.action, result: draft.result };
    try {
      await onSubmit({ ...draft, ...content, title: draft.title.trim(), period: draft.period?.trim() || null });
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError && caught.code === "EXPERIENCE_LIMIT_REACHED" ? COPY.limitReached : COPY.saveFailed);
      setBusy(false);
    }
  };

  const switchButton = "text-[13px] font-semibold text-brand-ink underline-offset-4 hover:underline";

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-[17px] font-bold text-ink">{heading}</p>
      <label className={label}>
        <span>{COPY.fields.title}</span>
        <input aria-label={COPY.fields.title} placeholder={COPY.fields.titlePlaceholder} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={100} className={`${field} font-bold`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <label className={label}>
          <span>{COPY.fields.period} {COPY.optional}</span>
          <input aria-label={COPY.fields.period} placeholder="2024.03 ~ 2024.12" value={draft.period ?? ""} onChange={(e) => setDraft({ ...draft, period: e.target.value })} maxLength={50} className={field} />
        </label>
        <div className={label}>
          <span>{COPY.fields.tags}</span>
          <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
        </div>
      </div>
      {mode === "free" ? (
        <div className="space-y-1.5">
          <label className={label}>
            <span>{COPY.free.label}</span>
            <textarea
              aria-label={COPY.free.label}
              placeholder={COPY.free.placeholder}
              value={draft.body ?? ""}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              maxLength={4500}
              rows={8}
              className={`${field} leading-[1.75]`}
            />
          </label>
          <div className="flex justify-end">
            <button type="button" onClick={() => switchMode("fields")} className={switchButton}>
              {COPY.free.toFields}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[13px] text-ink-4">{COPY.free.fieldsHint}</p>
            <button type="button" onClick={() => switchMode("free")} className={switchButton}>
              {COPY.free.toFree}
            </button>
          </div>
          {SECTIONS.map((key) => (
            <label key={key} className={label}>
              <span>{COPY.sections[key]} {COPY.optional}</span>
              <textarea
                aria-label={COPY.fields[key]}
                placeholder={COPY.fields[key]}
                value={draft[key]}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                maxLength={1500}
                rows={3}
                className={`${field} leading-[1.7]`}
              />
            </label>
          ))}
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 rounded-[10px] border border-line bg-surface px-4 text-[14px] font-semibold text-ink-3 hover:bg-fill-soft">{COPY.cancel}</button>
        <button type="submit" disabled={busy} className="h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white hover:bg-brand-hover disabled:opacity-50">{COPY.save}</button>
      </div>
    </form>
  );
}

function ExperienceDetail({ item, onEdit, onRemove }: { item: Experience; onEdit: () => void; onRemove: () => void }) {
  const period = formatPeriod(item.period);
  return (
    <article>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h3 className="text-[20px] font-bold leading-[1.4] tracking-[-0.02em] text-ink break-keep sm:text-[22px]">{item.title}</h3>
          {period && <p className="mt-1 text-[14px] tabular-nums text-ink-4">{period}</p>}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" aria-label={`${item.title} ${COPY.edit}`} onClick={onEdit} className="h-9 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-semibold text-ink-2 hover:bg-fill-soft">
            {COPY.edit}
          </button>
          <button type="button" aria-label={`${item.title} ${COPY.remove}`} onClick={onRemove} className="h-9 rounded-[10px] border border-line bg-surface px-3 text-[13.5px] font-semibold text-ink-4 hover:bg-fill-soft hover:text-danger">
            {COPY.remove}
          </button>
        </div>
      </div>
      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => <Capsule key={tag}>{tag}</Capsule>)}
        </div>
      )}
      {/* 자유 양식이면 글 그대로, 칸으로 썼으면 채운 칸만(빈 칸은 경고 없이 숨김) */}
      {item.body?.trim() ? (
        <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.85] text-ink-2 break-keep">{item.body}</p>
      ) : (
      <div className="mt-2">
        {SECTIONS.filter((key) => item[key].trim()).map((key) => (
          <section key={key} className="mt-5">
            <h4 className="text-[13px] font-semibold text-ink-4">{COPY.sections[key]}</h4>
            <p className="mt-1.5 whitespace-pre-line text-[15px] leading-[1.8] text-ink-2 break-keep">{item[key]}</p>
          </section>
        ))}
      </div>
      )}
    </article>
  );
}

/**
 * 내 경험 탭: 위는 찾기 + 자주 쓴 키워드(캡슐), 아래는 왼쪽 경험 카드 목록(좁게) + 오른쪽 자세히(넓게).
 * 폰에서는 목록 → 누르면 자세히 화면(목록으로 돌아가기). 새로 적기·고치기도 오른쪽 칸에서 한다.
 */
export default function ExperienceVault({ onCountChange }: { onCountChange?: (count: number) => void } = {}) {
  const [items, setItems] = useState<Experience[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<"new" | string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [query, setQuery] = useState("");
  const [keyword, setKeyword] = useState<string | null>(null);
  const [showAllKeywords, setShowAllKeywords] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listExperiences()
      .then(setItems)
      .catch(() => setLoadError(COPY.loadError));
  }, []);

  // 마이페이지 탭 숫자를 맞춘다(추가·가져오기·삭제 때마다).
  useEffect(() => {
    if (items) onCountChange?.(items.length);
  }, [items, onCountChange]);

  // 자주 쓴 키워드부터(같으면 가나다순).
  const keywords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items ?? []) for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko")).map(([tag]) => tag);
  }, [items]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((item) => {
      if (keyword && !item.tags.includes(keyword)) return false;
      if (!q) return true;
      return [item.title, item.situation, item.action, item.result, item.body ?? "", ...item.tags].some((text) => text.toLowerCase().includes(q));
    });
  }, [items, query, keyword]);

  if (loadError) return <p role="alert" className="py-10 text-center text-sm text-danger">{loadError}</p>;
  if (!items) return <div className="h-24 animate-pulse rounded-2xl bg-fill" />;

  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  const editingItem = editing && editing !== "new" ? items.find((item) => item.id === editing) ?? null : null;

  // 폰에서는 목록 대신 자세히 칸만 남으니, 긴 목록 아래쪽에서 눌렀어도 칸 머리로 올려 준다.
  const showDetailOnPhone = () => {
    setMobileDetail(true);
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "start" }));
    }
  };
  const open = (id: string) => {
    setSelectedId(id);
    setEditing(null);
    showDetailOnPhone();
  };
  const startNew = () => {
    setEditing("new");
    showDetailOnPhone();
  };
  const remove = async (item: Experience) => {
    if (!window.confirm(COPY.confirmRemove(item.title))) return;
    setDeleteError(null);
    try {
      await deleteExperience(item.id);
      setItems((current) => (current ?? []).filter((e) => e.id !== item.id));
      setSelectedId(null);
      setMobileDetail(false);
    } catch {
      setDeleteError(COPY.deleteFailed);
    }
  };

  const importDialog = (
    <ExperienceImportDialog
      open={importing}
      onClose={() => setImporting(false)}
      existingTitles={items.map((item) => item.title)}
      ownedCount={items.length}
      onSaved={(created) => {
        setItems((current) => [...created, ...(current ?? [])]);
        if (created[0]) setSelectedId(created[0].id);
      }}
    />
  );

  const form = editing === "new" ? (
    <ExperienceForm
      key="new"
      heading={COPY.newTitle}
      initial={EMPTY}
      onCancel={() => { setEditing(null); setMobileDetail(false); }}
      onSubmit={async (input) => {
        const created = await createExperience(input);
        setItems((current) => [created, ...(current ?? [])]);
        setSelectedId(created.id);
        setQuery("");
        setKeyword(null);
        setEditing(null);
      }}
    />
  ) : editingItem ? (
    <ExperienceForm
      key={editingItem.id}
      heading={COPY.editTitle}
      initial={{ title: editingItem.title, period: editingItem.period, situation: editingItem.situation, action: editingItem.action, result: editingItem.result, body: editingItem.body ?? "", tags: editingItem.tags }}
      onCancel={() => setEditing(null)}
      onSubmit={async (input) => {
        const updated = await updateExperience(editingItem.id, input);
        setItems((current) => (current ?? []).map((e) => (e.id === editingItem.id ? updated : e)));
        setEditing(null);
      }}
    />
  ) : null;

  // 빈 금고: 가운데 안내만(가져오기 + 직접 적기). 직접 적기를 누르면 그 자리에 적는 칸.
  if (items.length === 0) {
    return (
      <div>
        {form ? (
          <div className="rounded-[18px] bg-surface p-5 sm:p-7">{form}</div>
        ) : (
          <div className="rounded-[18px] bg-surface py-14 text-center">
            <p className="px-6 text-[14px] leading-relaxed text-ink-4">{COPY.empty}</p>
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="mt-5 h-12 rounded-xl bg-brand px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              {COPY.import.open}
            </button>
            <div>
              <button type="button" onClick={startNew} className="mt-3 h-10 rounded-[10px] px-4 text-[14px] font-semibold text-ink-3 transition-colors hover:bg-fill">
                {COPY.addManually}
              </button>
            </div>
          </div>
        )}
        {importDialog}
      </div>
    );
  }

  const shownKeywords = showAllKeywords ? keywords : keywords.slice(0, TOP_KEYWORDS);
  const capsuleButton = (active: boolean) =>
    `inline-flex h-[30px] items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors ${
      active ? "bg-ink text-white" : "bg-surface text-ink-3 hover:bg-fill"
    }`;

  return (
    <div>
      {/* ── 위: 찾기 + 버튼 / 키워드 거르기 (폰에서 자세히를 볼 땐 숨김) ── */}
      <div className={mobileDetail ? "hidden md:block" : undefined}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex h-[42px] items-center gap-2 rounded-xl border border-line bg-surface px-3.5 focus-within:border-brand sm:w-[300px]">
            <Search className="size-4 shrink-0 text-ink-5" aria-hidden="true" />
            <input
              type="search"
              aria-label={COPY.search}
              placeholder={COPY.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-5 focus:outline-none"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="h-10 flex-1 whitespace-nowrap rounded-[10px] border border-line bg-surface px-4 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-fill-soft sm:flex-none"
            >
              {COPY.import.open}
            </button>
            <button type="button" onClick={startNew} className="h-10 whitespace-nowrap rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-white transition-colors hover:bg-brand-hover">
              + {COPY.add}
            </button>
          </div>
        </div>
        {keywords.length > 0 && (
          <div role="group" aria-label={COPY.keywordLabel} className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] font-semibold text-ink-4">{COPY.keywordLabel}</span>
            <button type="button" aria-pressed={keyword === null} onClick={() => setKeyword(null)} className={capsuleButton(keyword === null)}>
              {COPY.allKeywords}
            </button>
            {shownKeywords.map((tag) => (
              <button key={tag} type="button" aria-pressed={keyword === tag} onClick={() => setKeyword(keyword === tag ? null : tag)} className={capsuleButton(keyword === tag)}>
                {tag}
              </button>
            ))}
            {keywords.length > TOP_KEYWORDS && (
              <button
                type="button"
                onClick={() => setShowAllKeywords((v) => !v)}
                className="inline-flex h-[30px] items-center rounded-full border border-dashed border-line px-3 text-[13px] font-semibold text-ink-4 hover:text-ink-2"
              >
                {showAllKeywords ? COPY.lessKeywords : COPY.moreKeywords(keywords.length - TOP_KEYWORDS)}
              </button>
            )}
          </div>
        )}
      </div>

      {deleteError && <p role="alert" className="mt-3 text-[13px] text-danger">{deleteError}</p>}

      {/* ── 아래: 왼쪽 목록(좁게) + 오른쪽 자세히(넓게) ── */}
      <div className="mt-5 grid items-start gap-4 md:grid-cols-[272px_minmax(0,1fr)]">
        <div className={mobileDetail ? "hidden md:block" : undefined}>
          <p className="mb-2.5 px-0.5 text-[13px] font-semibold text-ink-4">{COPY.count(visible.length)}</p>
          {visible.length === 0 ? (
            <p className="rounded-[14px] bg-surface px-4 py-6 text-center text-[13.5px] text-ink-4">{COPY.noMatch}</p>
          ) : (
            <ul aria-label={COPY.listLabel} className="space-y-2">
              {visible.map((item) => {
                const active = !editing && selected?.id === item.id;
                const period = formatPeriod(item.period);
                const rest = item.tags.length - 2;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => open(item.id)}
                      className={`block w-full rounded-[14px] border-[1.5px] bg-surface px-4 py-3.5 text-left transition-colors ${
                        active ? "border-ink" : "border-transparent hover:border-line"
                      }`}
                    >
                      {/* 두 줄까지, 단어 중간에서 끊지 않고 고르게 */}
                      <span className="line-clamp-2 text-[14.5px] font-bold leading-[1.45] text-ink [text-wrap:balance] break-keep">{item.title}</span>
                      {period && <span className="mt-1 block text-[12px] tabular-nums text-ink-4">{period}</span>}
                      {item.tags.length > 0 && (
                        <span className="mt-2 flex items-center gap-1 overflow-hidden">
                          {item.tags.slice(0, 2).map((tag) => <Capsule key={tag} small>{tag}</Capsule>)}
                          {rest > 0 && <span className="ml-0.5 text-[11.5px] text-ink-5">+{rest}</span>}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div ref={detailRef} className={`scroll-mt-20 rounded-[18px] bg-surface p-5 sm:p-7 ${mobileDetail ? "" : "hidden md:block"}`}>
          {mobileDetail && (
            <button
              type="button"
              onClick={() => { setMobileDetail(false); if (editing === "new") setEditing(null); }}
              className="-ml-1.5 mb-4 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[13.5px] font-semibold text-ink-3 hover:bg-fill md:hidden"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
              {COPY.back}
            </button>
          )}
          {form ??
            (selected ? (
              <ExperienceDetail item={selected} onEdit={() => setEditing(selected.id)} onRemove={() => void remove(selected)} />
            ) : (
              <p className="py-10 text-center text-[14px] text-ink-4">{COPY.noMatch}</p>
            ))}
        </div>
      </div>
      {importDialog}
    </div>
  );
}
