import { Link } from "wouter";
import type { ProjectSummary } from "@/types/my";
import KebabMenu, { createDefaultKebabItems } from "./KebabMenu";
import StageMenu, { type StagePatch } from "./StageMenu";
import { daysUntil } from "@/lib/workspace";
import { nextAction, type NextAction } from "@/lib/nextAction";
import { sendFunnelEvent } from "@/lib/siteVisits";
import { WORKSPACE_COPY } from "@/copy/workspaceCopy";
import { APPLICATION_BOARD_COPY } from "@/copy/applicationBoardCopy";

type Deadline = { label: string; tone: "urgent" | "normal" | "muted" | "passed" };

// 사흘 안 마감만 빨갛게. 그 밖은 회색 칸, 없으면 글자만, 지났으면 "마감 지남".
function deadlineOf(deadline: string | null | undefined): Deadline {
  const days = daysUntil(deadline ?? null);
  if (days === null) return { label: WORKSPACE_COPY.deadlineNone, tone: "muted" };
  if (days < 0) return { label: WORKSPACE_COPY.passedDeadline, tone: "passed" };
  if (days === 0) return { label: WORKSPACE_COPY.deadlineToday, tone: "urgent" };
  return { label: WORKSPACE_COPY.deadlineDays(days), tone: days <= 3 ? "urgent" : "normal" };
}

const DEADLINE_CLASS: Record<Deadline["tone"], string> = {
  urgent: "inline-flex h-7 items-center rounded-lg bg-danger-soft px-2.5 text-[13px] font-bold text-danger",
  normal: "inline-flex h-7 items-center rounded-lg bg-fill px-2.5 text-[13px] font-bold text-ink-2",
  muted: "text-[13px] text-ink-5",
  passed: "text-[13px] text-ink-5",
};

/** 카드의 주인공: 지금 단계에 맞는 행동 하나(설계 3.4절). 카드 전체 링크 위에 떠야 해서 z-10. */
function NextActionCell({ action }: { action: NextAction | null }) {
  if (!action) return <span className="text-[13.5px] text-ink-4">{APPLICATION_BOARD_COPY.next.offer}</span>;
  return (
    <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
      <p className="text-[12.5px] text-ink-4 break-keep">{action.reason}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={action.href}
          onClick={() => void sendFunnelEvent("content_cta_click", action.track)}
          className="inline-flex h-9 items-center rounded-[10px] bg-brand px-3.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          {action.label}
        </Link>
        {action.secondary && (
          <Link href={action.secondary.href} className="text-[13px] font-semibold text-ink-3 underline-offset-2 hover:underline">
            {action.secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * 내 지원서 목록. 넓은 화면은 지원 현황표(회사·직무 | 마감 | 단계 | 지금 할 일), 폰은 같은 순서의 작은 카드.
 * 줄(카드) 아무 데나 누르면 지원서 화면으로 간다. 더보기(삭제)만 그 위에 따로 동작한다. 순서는 부모가 정해 넘긴다.
 */
export default function ApplicationList({
  projects,
  onOpen,
  onDelete,
  onStageChange,
}: {
  projects: ProjectSummary[];
  onOpen: (project: ProjectSummary) => void;
  onDelete: (project: ProjectSummary) => void;
  onStageChange: (project: ProjectSummary, patch: StagePatch) => Promise<void>;
}) {
  const rows = projects.map((project) => ({
    project,
    deadline: deadlineOf(project.deadline),
    action: nextAction(project),
    name: project.company_name || project.title || "기업 미지정",
  }));

  return (
    <>
      <table className="hidden w-full table-fixed border-collapse overflow-hidden rounded-[18px] bg-surface md:table">
        <thead>
          <tr className="border-b border-line bg-fill-soft text-left text-[13px] font-semibold text-ink-4">
            <th className="w-[26%] px-5 py-3.5 font-semibold">{WORKSPACE_COPY.table.application}</th>
            <th className="w-[12%] px-5 py-3.5 font-semibold">{WORKSPACE_COPY.table.deadline}</th>
            <th className="w-[16%] px-5 py-3.5 font-semibold">{APPLICATION_BOARD_COPY.table.stage}</th>
            <th className="px-5 py-3.5 font-semibold">{APPLICATION_BOARD_COPY.table.next}</th>
            <th className="w-12" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ project, deadline, action, name }) => (
            <tr
              key={project.id}
              data-testid="application-row"
              onClick={() => onOpen(project)}
              className={`cursor-pointer border-b border-line-soft transition-colors last:border-b-0 hover:bg-fill-soft ${deadline.tone === "passed" ? "opacity-55" : ""}`}
            >
              <td className="px-5 py-4 align-middle">
                <button
                  type="button"
                  aria-label={WORKSPACE_COPY.open(name)}
                  onClick={(e) => { e.stopPropagation(); onOpen(project); }}
                  className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                >
                  <span className="block text-[16px] font-bold text-ink break-keep">{name}</span>
                  {project.job_role && <span className="mt-0.5 block text-[13px] text-ink-3 break-keep">{project.job_role}</span>}
                </button>
              </td>
              <td className="px-5 py-4 align-middle"><span className={DEADLINE_CLASS[deadline.tone]}>{deadline.label}</span></td>
              <td className="px-5 py-4 align-middle">
                <StageMenu project={project} onChange={(patch) => onStageChange(project, patch)} />
              </td>
              <td className="px-5 py-4 align-middle">
                <NextActionCell action={action} />
              </td>
              <td className="pr-3 align-middle">
                <KebabMenu items={createDefaultKebabItems({ onDelete: () => onDelete(project) })} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-2.5 md:hidden">
        {rows.map(({ project, deadline, action, name }) => (
          <li
            key={project.id}
            data-testid="application-card"
            className={`relative rounded-2xl bg-surface p-4 ${deadline.tone === "passed" ? "opacity-55" : ""}`}
          >
            <button
              type="button"
              aria-label={WORKSPACE_COPY.open(name)}
              onClick={() => onOpen(project)}
              className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h3 className="text-[16px] font-bold text-ink break-keep">{name}</h3>
                  <StageMenu project={project} onChange={(patch) => onStageChange(project, patch)} />
                </div>
                {project.job_role && <p className="mt-0.5 text-[13px] text-ink-3 break-keep">{project.job_role}</p>}
              </div>
              <div className="relative z-10 -mr-2 -mt-1 flex shrink-0 items-center gap-0.5">
                <span className={DEADLINE_CLASS[deadline.tone]}>{deadline.label}</span>
                <KebabMenu items={createDefaultKebabItems({ onDelete: () => onDelete(project) })} />
              </div>
            </div>
            <div className="mt-3">
              <NextActionCell action={action} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
