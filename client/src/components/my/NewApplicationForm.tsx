import { useState } from "react";
import JobPostingSection from "@/components/analyze/JobPostingSection";
import { createApplication, updateApplicationMeta, WorkspaceApiError } from "@/lib/workspace";
import type { JobPostingRecord } from "@/types/jobPosting";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.newApplicationForm;
const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";
const label = "block space-y-1.5 text-[13px] font-semibold text-ink-3";
const card = "rounded-[20px] bg-surface p-5 sm:p-7";

/**
 * 새 지원서(전체 화면 /my/new): 채용공고 붙이기(선택) → 회사·직무·마감 → 문항.
 * 공고를 읽으면 비어 있는 회사·직무를 공고에서 채운다. 만들면 공고를 지원서에 붙이고 작성 화면으로 넘긴다.
 */
export default function NewApplicationForm({
  onCreated,
  onCancel,
  onRequireLogin,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
  onRequireLogin: () => void;
}) {
  const [posting, setPosting] = useState<JobPostingRecord | null>(null);
  const [company, setCompany] = useState("");
  const [jobKeyword, setJobKeyword] = useState("");
  const [deadline, setDeadline] = useState("");
  const [prompts, setPrompts] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attachPosting = (record: JobPostingRecord | null) => {
    setPosting(record);
    if (!record) return;
    // 직접 적은 값은 덮어쓰지 않는다
    if (!company.trim() && record.summary.company.trim()) setCompany(record.summary.company.trim().slice(0, 100));
    if (!jobKeyword.trim() && record.summary.role.trim()) setJobKeyword(record.summary.role.trim().slice(0, 100));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!company.trim()) {
      setError(COPY.companyRequired);
      return;
    }
    setBusy(true);
    setError(null);
    let id: string;
    try {
      ({ id } = await createApplication({
        company: company.trim(),
        ...(jobKeyword.trim() ? { jobKeyword: jobKeyword.trim() } : {}),
        // <input type="date"> 는 날짜만 준다. 마감은 그날 23:59 KST 로 본다.
        deadline: deadline ? `${deadline}T23:59:00+09:00` : null,
        questions: prompts.filter((p) => p.trim()).map((prompt) => ({ prompt: prompt.trim(), charLimit: null, answer: "" })),
      }));
    } catch (caught) {
      setError(caught instanceof WorkspaceApiError && caught.code === "PROJECT_LIMIT_REACHED" ? COPY.limitReached : COPY.createFailed);
      setBusy(false);
      return;
    }
    // 공고 붙이기에 실패해도 지원서는 만들어졌다. 작성 화면에서 다시 붙일 수 있으니 그대로 넘어간다.
    if (posting) await updateApplicationMeta(id, { jobPostingId: posting.id }).catch(() => undefined);
    onCreated(id);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* 제목·설명은 분석 폼과 같은 공고 칸의 것을 그대로 쓴다(두 번 겹치지 않게) */}
      <section className={card}>
        <JobPostingSection value={posting} onChange={attachPosting} isAuthenticated onRequireLogin={onRequireLogin} tone="light" />
      </section>

      <section className={`${card} space-y-4`}>
        <h2 className="text-[16px] font-bold text-ink">{COPY.basicsTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>
            <span>{COPY.company} *</span>
            <input aria-label={COPY.company} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} placeholder={COPY.companyPlaceholder} className={field} />
          </label>
          <label className={label}>
            <span>{COPY.job}</span>
            <input aria-label={COPY.job} value={jobKeyword} onChange={(e) => setJobKeyword(e.target.value)} maxLength={100} placeholder={COPY.jobPlaceholder} className={field} />
          </label>
        </div>
        <label className={`${label} sm:max-w-[240px]`}>
          <span>{COPY.deadline}</span>
          <input aria-label={COPY.deadline} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={field} />
        </label>
      </section>

      <section className={`${card} space-y-3`}>
        <div>
          <h2 className="text-[16px] font-bold text-ink">{COPY.questionsTitle}</h2>
          <p className="mt-1 text-[13.5px] text-ink-4">{COPY.questionsHint}</p>
        </div>
        {prompts.map((prompt, index) => (
          <label key={index} className={label}>
            <span>{WORKSPACE_COPY.questionLabel(index + 1)}</span>
            <textarea
              aria-label={WORKSPACE_COPY.questionLabel(index + 1)}
              value={prompt}
              onChange={(e) => setPrompts((current) => current.map((p, i) => (i === index ? e.target.value : p)))}
              maxLength={300}
              rows={2}
              placeholder={WORKSPACE_COPY.editor.promptPlaceholder}
              className={`${field} leading-[1.6]`}
            />
          </label>
        ))}
        {prompts.length < 5 && (
          <button type="button" onClick={() => setPrompts((c) => [...c, ""])} className="text-[13.5px] font-semibold text-brand-ink hover:text-brand">
            + {WORKSPACE_COPY.editor.addQuestion}
          </button>
        )}
      </section>

      {error && <p role="alert" className="text-[13.5px] text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-xl border border-line bg-surface px-5 text-[15px] font-semibold text-ink-3 hover:bg-fill-soft">{COPY.cancel}</button>
        <button type="submit" disabled={busy} className="h-11 rounded-xl bg-brand px-5 text-[15px] font-bold text-white hover:bg-brand-hover disabled:opacity-50">{COPY.submit}</button>
      </div>
    </form>
  );
}
