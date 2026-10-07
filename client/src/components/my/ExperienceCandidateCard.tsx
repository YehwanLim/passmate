import type { ExperienceCandidate } from "@/lib/experienceImport";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const FIELDS = WORKSPACE_COPY.experiences.fields;
const COPY = WORKSPACE_COPY.experiences.import;
const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";
const emptyField = "border-transparent bg-blank-soft placeholder:text-blank";

export type EditableCandidate = ExperienceCandidate & { key: string; selected: boolean; similar: boolean; tagText: string };

/** 자동 채우기 후보 한 장: 고르기·바로 고치기·빈칸 표시·근거 원문. */
export default function ExperienceCandidateCard({
  item,
  onChange,
}: {
  item: EditableCandidate;
  onChange: (next: EditableCandidate) => void;
}) {
  const set = (patch: Partial<EditableCandidate>) => onChange({ ...item, ...patch });
  const area = (key: "situation" | "action" | "result") => (
    <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
      <span>{FIELDS[key]}</span>
      <textarea
        aria-label={FIELDS[key]}
        value={item[key]}
        placeholder={COPY.blank}
        onChange={(e) => set({ [key]: e.target.value } as Partial<EditableCandidate>)}
        maxLength={1500}
        rows={2}
        className={`${field} resize-y leading-relaxed ${item[key].trim() ? "" : emptyField}`}
      />
    </label>
  );

  return (
    <article className={`space-y-3 rounded-2xl border bg-surface p-5 ${item.selected ? "border-brand" : "border-line"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={(e) => set({ selected: e.target.checked })}
          aria-label={COPY.pick(item.title)}
          className="mt-3 size-5 shrink-0 accent-[#0064FF]"
        />
        <label className="block min-w-0 flex-1 space-y-1.5 text-[13px] font-semibold text-ink-3">
          <span>{FIELDS.title}</span>
          <input
            aria-label={FIELDS.title}
            value={item.title}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={100}
            className={`${field} font-bold`}
          />
        </label>
      </div>
      {item.similar && <p className="text-[13px] font-semibold text-blank">{COPY.similar}</p>}
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{FIELDS.period}</span>
        <input
          aria-label={FIELDS.period}
          value={item.period}
          placeholder={COPY.blank}
          onChange={(e) => set({ period: e.target.value })}
          maxLength={50}
          className={`${field} ${item.period.trim() ? "" : emptyField}`}
        />
      </label>
      {area("situation")}
      {area("action")}
      {area("result")}
      <label className="block space-y-1.5 text-[13px] font-semibold text-ink-3">
        <span>{FIELDS.tags}</span>
        <input aria-label={FIELDS.tags} value={item.tagText} onChange={(e) => set({ tagText: e.target.value })} className={field} />
      </label>
      {item.quotes.length > 0 && (
        <p className="text-[12.5px] leading-relaxed text-ink-4">
          {COPY.quoteLabel}: {item.quotes.join(" / ")}
        </p>
      )}
    </article>
  );
}
