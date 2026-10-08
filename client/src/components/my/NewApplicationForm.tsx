import type { RefObject } from "react";
import CompanyCombobox from "@/components/analyze/CompanyCombobox";
import JobPostingSection from "@/components/analyze/JobPostingSection";
import JobRoleCombobox from "@/components/analyze/JobRoleCombobox";
import type { JobPostingRecord } from "@/types/jobPosting";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

const COPY = WORKSPACE_COPY.newApplicationForm;
const field = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14.5px] text-ink placeholder:text-ink-5 focus:border-brand focus:outline-none";
const label = "block space-y-1.5 text-[12.5px] font-semibold text-ink-4";

export type NewApplicationInfo = { company: string; jobKeyword: string; deadline: string };

/**
 * 새 지원서 편집기의 오른쪽 칸: 채용공고 붙이기(선택) + 지원 정보(회사 필수·직무·마감).
 * 회사·직무는 자소서 분석과 같은 자동완성. 다 적고 "지원서 만들기"를 누르면 onCommit — 그때 지원서를 만들고 저장이 시작된다(10-08:
 * 회사를 정하는 순간 만들면 직무·마감일을 적기 전에 화면이 넘어가 버렸다). 상태는 페이지가 가진다.
 */
export default function NewApplicationForm({
  posting,
  onPosting,
  info,
  onInfo,
  onCommit,
  onRequireLogin,
  companyRef,
  error,
  busy,
}: {
  posting: JobPostingRecord | null;
  onPosting: (record: JobPostingRecord | null) => void;
  info: NewApplicationInfo;
  onInfo: (info: NewApplicationInfo) => void;
  /** 고른 직후엔 페이지 상태가 아직 옛 값이라 정해진 지원 정보를 함께 넘긴다. */
  onCommit: (info: NewApplicationInfo) => void;
  onRequireLogin: () => void;
  companyRef?: RefObject<HTMLInputElement | null>;
  error: string | null;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* 제목·설명은 분석 폼과 같은 공고 칸의 것을 그대로 쓴다 */}
      <section className="rounded-[18px] bg-surface p-5">
        <JobPostingSection value={posting} onChange={onPosting} isAuthenticated onRequireLogin={onRequireLogin} tone="light" />
      </section>

      <section className="space-y-3 rounded-[18px] bg-surface p-5">
        <h2 className="text-[15px] font-bold text-ink">{COPY.basicsTitle}</h2>
        <label className={label}>
          <span>{COPY.company} *</span>
          <CompanyCombobox
            compact
            inputRef={companyRef}
            ariaLabel={COPY.company}
            value={info.company}
            disabled={busy}
            onChange={(company) => onInfo({ ...info, company })}
            placeholder={COPY.companyPlaceholder}
          />
        </label>
        <label className={label}>
          <span>{COPY.job}</span>
          <JobRoleCombobox
            compact
            ariaLabel={COPY.job}
            value={info.jobKeyword}
            disabled={busy}
            onChange={(jobKeyword) => onInfo({ ...info, jobKeyword })}
            placeholder={COPY.jobPlaceholder}
          />
        </label>
        <label className={label}>
          <span>{COPY.deadline}</span>
          <input aria-label={COPY.deadline} type="date" value={info.deadline} disabled={busy} onChange={(e) => onInfo({ ...info, deadline: e.target.value })} className={field} />
        </label>
        <button
          type="button"
          onClick={() => onCommit(info)}
          disabled={busy || !info.company.trim()}
          className="h-12 w-full rounded-xl bg-brand text-[15px] font-bold text-white transition-colors hover:bg-brand-hover disabled:opacity-40"
        >
          {busy ? COPY.creating : COPY.submit}
        </button>
        <p className="text-[12.5px] text-ink-4">{COPY.saveHint}</p>
        {error && <p role="alert" className="text-[13px] font-medium text-danger">{error}</p>}
      </section>
    </div>
  );
}
