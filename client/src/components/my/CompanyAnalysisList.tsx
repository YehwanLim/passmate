import type { ProjectSummary } from "@/types/my";
import KebabMenu, { createDefaultKebabItems } from "./KebabMenu";
import { formatDate } from "@/lib/formatDate";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

function summaryOf(project: ProjectSummary): string | null {
  if (project.latest_status === "PENDING") return WORKSPACE_COPY.analyzingSummary;
  if (project.latest_status === "FAILED") return WORKSPACE_COPY.companyTab.failed;
  return project.summary?.trim() || null;
}

/**
 * 기업 분석 목록. 내 지원서와 같은 표 모양(회사 | 분석한 날 | 요약), 폰은 카드.
 * 볼 것이 리포트 하나라 누르면 기업 분석 리포트로 바로 간다(어디로 갈지는 부모가 정한다).
 */
export default function CompanyAnalysisList({
  projects,
  onOpen,
  onDelete,
}: {
  projects: ProjectSummary[];
  onOpen: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
}) {
  const rows = projects.map((project) => ({
    project,
    name: project.company_name || project.title || "기업 미지정",
    date: formatDate(project.created_at, "ymd-dot"),
    summary: summaryOf(project),
  }));

  return (
    <>
      <table className="hidden w-full table-fixed border-collapse overflow-hidden rounded-[18px] bg-surface md:table">
        <thead>
          <tr className="border-b border-line bg-fill-soft text-left text-[13px] font-semibold text-ink-4">
            <th className="w-[26%] px-5 py-3.5 font-semibold">{WORKSPACE_COPY.table.company}</th>
            <th className="w-[14%] px-5 py-3.5 font-semibold">{WORKSPACE_COPY.table.analyzedAt}</th>
            <th className="px-5 py-3.5 font-semibold">{WORKSPACE_COPY.table.summary}</th>
            <th className="w-12" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ project, name, date, summary }) => (
            <tr
              key={project.id}
              data-testid="company-row"
              onClick={() => onOpen(project)}
              className="cursor-pointer border-b border-line-soft transition-colors last:border-b-0 hover:bg-fill-soft"
            >
              <td className="px-5 py-4 align-middle">
                <button
                  type="button"
                  aria-label={WORKSPACE_COPY.open(name)}
                  onClick={(e) => { e.stopPropagation(); onOpen(project); }}
                  className="block w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="block text-[16px] font-bold text-ink break-keep">{name}</span>
                  {project.job_role && <span className="mt-0.5 block text-[13px] text-ink-3 break-keep">{project.job_role}</span>}
                </button>
              </td>
              <td className="px-5 py-4 align-middle text-[14px] tabular-nums text-ink-3">{date}</td>
              <td className="px-5 py-4 align-middle text-[14px] leading-[1.55] text-ink-2 break-keep">{summary}</td>
              <td className="pr-3 align-middle">
                <KebabMenu items={createDefaultKebabItems({ onDelete: () => onDelete(project) })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-2.5 md:hidden">
        {rows.map(({ project, name, date, summary }) => (
          <li key={project.id} data-testid="company-card" className="relative rounded-2xl bg-surface p-4">
            <button
              type="button"
              aria-label={WORKSPACE_COPY.open(name)}
              onClick={() => onOpen(project)}
              className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[16px] font-bold text-ink break-keep">{name}</h3>
                {project.job_role && <p className="mt-0.5 text-[13px] text-ink-3 break-keep">{project.job_role}</p>}
              </div>
              <div className="relative z-10 -mr-2 -mt-1 flex shrink-0 items-center gap-0.5">
                <span className="text-[12.5px] tabular-nums text-ink-4">{date}</span>
                <KebabMenu items={createDefaultKebabItems({ onDelete: () => onDelete(project) })} />
              </div>
            </div>
            {summary && <p className="mt-2.5 text-[13.5px] leading-[1.55] text-ink-2 break-keep">{summary}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}
