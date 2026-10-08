import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, FileText } from "lucide-react";

import { formatDate } from "@/lib/formatDate";
import type { ProjectSummary } from "@/types/my";

// Radix Select 는 빈 문자열 값을 받지 않는다 — "연결하지 않기"는 이 표식으로 두고 밖으로는 "" 로 내보낸다.
const NONE = "__none__";

const nameOf = (project: ProjectSummary) =>
  (project.company_name || project.title) + (project.job_role ? ` · ${project.job_role}` : "");
const dateOf = (project: ProjectSummary) => formatDate(project.updated_at ?? project.created_at, "ymd-dot");

/**
 * 기업 분석에서 내 자소서 분석을 고르는 목록. 브라우저 기본 select 는 이름만 한 줄로 나와 같은 회사가 여럿이면 헷갈려서,
 * 회사·직무 아래에 날짜를 함께 보여 주는 목록으로 그린다. 값은 latest_analysis_id(없으면 "").
 */
export default function ResumeLinkSelect({
  resumes,
  value,
  onChange,
}: {
  resumes: ProjectSummary[];
  value: string;
  onChange: (analysisId: string) => void;
}) {
  const selected = resumes.find(project => project.latest_analysis_id === value) ?? null;

  return (
    <SelectPrimitive.Root value={value || NONE} onValueChange={next => onChange(next === NONE ? "" : next)}>
      <SelectPrimitive.Trigger
        aria-label="연결할 자소서 분석"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2 text-left text-[14.5px] text-ink outline-none transition-colors hover:bg-fill-soft focus-visible:border-brand data-[state=open]:border-brand"
      >
        <SelectPrimitive.Value>
          {selected ? (
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{nameOf(selected)}</span>
              <span className="block text-[12px] tabular-nums text-ink-4">{dateOf(selected)}</span>
            </span>
          ) : (
            <span className="text-ink-3">연결하지 않기</span>
          )}
        </SelectPrimitive.Value>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-4" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[min(360px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_rgba(25,31,40,0.12)]"
        >
          <SelectPrimitive.Viewport className="p-1.5">
            <Option value={NONE}>
              <span className="text-[14px] text-ink-3">연결하지 않기</span>
            </Option>
            {resumes.map(project =>
              project.latest_analysis_id ? (
                <Option key={project.id} value={project.latest_analysis_id}>
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-5" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <SelectPrimitive.ItemText>
                      <span className="block truncate text-[14px] font-semibold text-ink">{nameOf(project)}</span>
                    </SelectPrimitive.ItemText>
                    <span className="block text-[12px] tabular-nums text-ink-4">{dateOf(project)}</span>
                  </span>
                </Option>
              ) : null
            )}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

function Option({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <SelectPrimitive.Item
      value={value}
      className="relative flex cursor-pointer select-none items-start gap-2.5 rounded-lg py-2.5 pl-3 pr-9 outline-none data-[highlighted]:bg-fill data-[state=checked]:bg-brand-soft"
    >
      {children}
      <SelectPrimitive.ItemIndicator className="absolute right-3 top-1/2 -translate-y-1/2">
        <Check className="h-4 w-4 text-brand" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}
