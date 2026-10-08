import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, PenLine, Search, Trash2, X } from "lucide-react";
import {
  buildPeriod,
  createExperience,
  deleteExperience,
  formatPeriod,
  isPeriodReversed,
  parsePeriod,
  listExperiences,
  updateExperience,
  WorkspaceApiError,
  type Experience,
  type ExperienceInput,
  type YearMonth,
} from "@/lib/workspace";
import { parseTags } from "@/lib/experienceImport";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";
import ExperienceImportDialog from "./ExperienceImportDialog";
import KebabMenu from "./KebabMenu";

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

const PP = COPY.periodPicker;
const capsule = "inline-flex h-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors";

/** 숫자만 쳐도 "2024.03" 모양으로: 202403 → 2024.03, 20243 → 2024.3 */
function formatYearMonthInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 6);
  return digits.length > 4 ? `${digits.slice(0, 4)}.${digits.slice(4)}` : digits;
}

function readYearMonth(text: string): YearMonth | null {
  const m = text.match(/^(\d{4})\.(\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

const toText = (v: YearMonth | null | undefined) => (v ? `${v.year}.${String(v.month).padStart(2, "0")}` : "");

/**
 * 연·월 한 칸: 숫자로 바로 치거나(202403 → 2024.03), 칸을 누르면 뜨는 작은 창에서 연도 캡슐 → 월 캡슐로 고른다.
 */
function YearMonthField({
  label: fieldLabel,
  text,
  onText,
  disabled,
  years,
}: {
  label: string;
  text: string;
  onText: (text: string) => void;
  disabled?: boolean;
  years: number[];
}) {
  const [open, setOpen] = useState(false);
  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const openPicker = () => {
    if (disabled) return;
    setPickedYear(readYearMonth(text)?.year ?? null);
    setOpen(true);
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        aria-label={fieldLabel}
        inputMode="numeric"
        placeholder="2024.03"
        value={disabled ? "" : text}
        disabled={disabled}
        onFocus={openPicker}
        onClick={openPicker}
        onChange={(e) => {
          setOpen(false); // 직접 치기 시작하면 고르기 창은 닫는다
          onText(formatYearMonthInput(e.target.value));
        }}
        onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Tab") setOpen(false); }}
        className="h-[42px] w-[112px] rounded-xl border border-line bg-surface px-3 text-[14px] tabular-nums text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none disabled:bg-fill"
      />
      {open && (
        <div role="dialog" aria-label={PP.pickerLabel(fieldLabel)} className="absolute left-0 top-full z-30 mt-1.5 w-[268px] rounded-2xl border border-line bg-surface p-3 shadow-[0_12px_32px_rgba(18,32,90,0.12)]">
          {pickedYear === null ? (
            <>
              <p className="mb-2 px-1 text-[12.5px] font-semibold text-ink-4">{PP.chooseYear}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {years.map((year) => (
                  <button key={year} type="button" onClick={() => setPickedYear(year)} className={`${capsule} bg-fill text-ink-2 hover:bg-line`}>
                    {year}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between px-1">
                <button type="button" onClick={() => setPickedYear(null)} className="inline-flex items-center gap-0.5 text-[12.5px] font-semibold text-ink-3 hover:text-ink">
                  <ChevronLeft className="size-3.5" aria-hidden="true" />
                  {PP.yearLabel(pickedYear)}
                </button>
                <span className="text-[12.5px] font-semibold text-ink-4">{PP.chooseMonth}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
                  const current = readYearMonth(text);
                  const active = current?.year === pickedYear && current.month === month;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => { onText(toText({ year: pickedYear, month })); setOpen(false); }}
                      className={`${capsule} ${active ? "bg-ink text-white" : "bg-fill text-ink-2 hover:bg-line"}`}
                    >
                      {month}월
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 경험 기간: 시작 ~ 끝 · 진행 중. 늘 "2024.03 ~ 2024.12" 같은 정해진 형식으로 저장한다.
 * 옛 자유 형식("2024 여름")은 고르기 전까지 그대로 둔다.
 */
function PeriodPicker({ value, onChange }: { value: string | null; onChange: (value: string | null, error: string | null) => void }) {
  const [initial] = useState(() => parsePeriod(value)); // 처음 연 값만 읽는다
  const legacy = initial === null && value ? value : null;
  const [startText, setStartText] = useState(toText(initial?.start));
  const [endText, setEndText] = useState(toText(initial?.end));
  const [ongoing, setOngoing] = useState(initial?.ongoing ?? false);

  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list = Array.from({ length: 16 }, (_, i) => thisYear - i);
    for (const y of [initial?.start?.year, initial?.end?.year]) if (y && !list.includes(y)) list.push(y);
    return list.sort((a, b) => b - a);
  }, [thisYear, initial]);

  const update = (next: { startText?: string; endText?: string; ongoing?: boolean }) => {
    const v = { startText, endText, ongoing, ...next };
    setStartText(v.startText); setEndText(v.endText); setOngoing(v.ongoing);
    const start = readYearMonth(v.startText);
    const end = v.ongoing ? null : readYearMonth(v.endText);
    const touched = Boolean(v.startText || v.endText || v.ongoing);
    if (!touched) return onChange(legacy, null); // 아무것도 안 골랐으면 옛 값 유지(없으면 비움)
    if ((v.startText && !start) || (!v.ongoing && v.endText && !end)) return onChange(null, PP.invalid);
    const parts = { start, end, ongoing: v.ongoing };
    if (!start) return onChange(null, PP.needStart);
    if (isPeriodReversed(parts)) return onChange(buildPeriod(parts), PP.reversed);
    onChange(buildPeriod(parts), null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <YearMonthField label={PP.start} text={startText} onText={(text) => update({ startText: text })} years={years} />
        {/* "~" 는 끝과 함께 줄을 바꾼다(좁은 화면에서 윗줄 끝에 홀로 남지 않게) */}
        <div className="flex items-center gap-2">
          <span className="text-ink-5" aria-hidden="true">~</span>
          <YearMonthField label={PP.end} text={endText} onText={(text) => update({ endText: text })} disabled={ongoing} years={years} />
        </div>
        <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-[14px] font-medium text-ink-3">
          <input type="checkbox" checked={ongoing} onChange={(e) => update({ ongoing: e.target.checked })} className="size-4 accent-brand" />
          {PP.ongoing}
        </label>
      </div>
      {legacy && <p className="text-[12.5px] text-ink-4">{PP.legacy(legacy)}</p>}
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
  const [periodError, setPeriodError] = useState<string | null>(null);
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
    if (periodError) {
      setError(periodError);
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
      <div className={label}>
        <span>{COPY.fields.period} {COPY.optional}</span>
        <PeriodPicker
          value={draft.period}
          onChange={(period, problem) => {
            setDraft((current) => ({ ...current, period }));
            setPeriodError(problem);
          }}
        />
        {periodError && <p className="text-[12.5px] font-medium text-danger">{periodError}</p>}
      </div>
      <div className={label}>
        <span>{COPY.fields.tags}</span>
        <TagInput tags={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[20px] font-bold leading-[1.4] tracking-[-0.02em] text-ink break-keep sm:text-[22px]">{item.title}</h3>
          {period && <p className="mt-1 text-[14px] tabular-nums text-ink-4">{period}</p>}
        </div>
        {/* 수정·삭제는 ⋯ 안에 — 읽는 화면에서 버튼이 먼저 눈에 띄지 않게(내 지원서 표와 같은 메뉴) */}
        <div className="-mr-2 -mt-1 shrink-0">
          <KebabMenu
            label={COPY.more(item.title)}
            items={[
              { label: COPY.edit, icon: PenLine, onClick: onEdit },
              { label: COPY.remove, icon: Trash2, onClick: onRemove, danger: true },
            ]}
          />
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
 * 폰에서는 목록 → 누르면 자세히 화면(목록으로 돌아가기). 직접 추가·수정도 오른쪽 칸에서 한다.
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
    if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches) {
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

  // 빈 금고: 가운데 안내만(자동 추가 + 직접 추가). 직접 추가를 누르면 그 자리에 적는 칸.
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
      <div className={mobileDetail ? "hidden sm:block" : undefined}>
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
      {/* 640px 이상이면 왼쪽은 사이드바처럼 좁게(220~272px), 오른쪽 자세히가 본문. 폰만 목록 → 자세히 */}
      <div className="mt-5 grid items-start gap-3 sm:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-4">
        <div className={mobileDetail ? "hidden sm:block" : undefined}>
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

        <div ref={detailRef} className={`scroll-mt-20 rounded-[18px] bg-surface p-5 sm:p-7 ${mobileDetail ? "" : "hidden sm:block"}`}>
          {mobileDetail && (
            <button
              type="button"
              onClick={() => { setMobileDetail(false); if (editing === "new") setEditing(null); }}
              className="-ml-1.5 mb-4 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[13.5px] font-semibold text-ink-3 hover:bg-fill sm:hidden"
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
