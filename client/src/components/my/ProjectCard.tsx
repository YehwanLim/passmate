import type { ProjectSummary } from "@/types/my";
import KebabMenu, { createDefaultKebabItems } from "./KebabMenu";
import { formatDate } from "@/lib/formatDate";
import { daysUntil } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

interface ProjectCardProps {
  project: ProjectSummary;
  /** 카드 아무 데나 누르면 연다. 자소서는 지원서 화면, 기업 분석은 리포트(무엇을 열지는 부모가 정한다). */
  onOpen: () => void;
  onDelete?: () => void;
}

type Deadline = { label: string; tone: "urgent" | "normal" | "muted" };

// 사흘 안 마감만 빨갛게. 그 밖은 회색 칸, 지났거나 없으면 글자만.
function deadlineOf(deadline: string | null | undefined): Deadline {
  const days = daysUntil(deadline ?? null);
  if (days === null) return { label: WORKSPACE_COPY.deadlineNone, tone: "muted" };
  if (days < 0) return { label: WORKSPACE_COPY.deadlinePassed, tone: "muted" };
  if (days === 0) return { label: WORKSPACE_COPY.deadlineToday, tone: "urgent" };
  return { label: WORKSPACE_COPY.deadlineDays(days), tone: days <= 3 ? "urgent" : "normal" };
}

const DEADLINE_CLASS: Record<Deadline["tone"], string> = {
  urgent: "h-7 rounded-lg bg-danger-soft px-2.5 text-[13px] font-bold text-danger",
  normal: "h-7 rounded-lg bg-fill px-2.5 text-[13px] font-bold text-ink-2",
  muted: "text-[13px] text-ink-5",
};

/**
 * 마이페이지 지원서 블록 카드: 종류·마감 / 회사·직무 / 요약 전문(진단 전이면 작성 진행) / 문항 수·작성일·더보기.
 * 버튼을 따로 두지 않고 카드 전체가 하나의 열기 버튼이다(자소서·기업 분석이 같은 동작). 더보기만 그 위에 떠 있다.
 */
export default function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const kebabItems = createDefaultKebabItems({ onDelete });
  const isCompany = project.kind === "COMPANY";
  const keywords = project.keywords ?? [];
  // 상태는 서버가 내려준 최신 analysis 기준으로만 판단한다. 키워드가 비었다고 대기중으로 보지 않는다
  // (구버전 리포트는 키워드 필드가 없을 수 있다).
  const isPending = project.latest_status === "PENDING";
  const isFailed = project.latest_status === "FAILED";
  // "새 지원서"로 만들고 아직 진단받지 않은 지원서: 요약 대신 작성 진행을 보여 준다.
  const isDraftOnly = !isCompany && !project.latest_analysis_id;
  const summary = isPending
    ? "아직 분석이 끝나지 않았어요."
    : isFailed
      ? "분석하지 못했어요. 다시 시도해 주세요."
      : project.summary?.trim() || null;
  const deadline = deadlineOf(project.deadline);
  const draftTotal = project.draft_question_count ?? 0;
  const answered = project.answered_count ?? 0;
  const questionCount = isDraftOnly ? draftTotal : project.question_count ?? project.analysis_count;
  const name = project.company_name || project.title || "기업 미지정";
  const kindLabel = project.id === "mock-proj-1" ? "샘플" : isCompany ? "기업 분석" : "자소서";

  return (
    <div
      data-testid="application-card"
      className="group relative flex w-full flex-col rounded-[18px] border border-line-soft bg-surface p-5 transition-colors hover:border-line hover:bg-fill-soft"
    >
      {/* 카드 전체를 덮는 열기 버튼. 글자는 그 아래에 그대로 읽힌다. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${name} 열기`}
        className="absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />

      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-ink-4">{kindLabel}</span>
        {!isCompany && <span className={`inline-flex items-center ${DEADLINE_CLASS[deadline.tone]}`}>{deadline.label}</span>}
      </div>

      <h3 className="mt-2 text-[18px] font-bold tracking-tight text-ink break-keep">{name}</h3>
      {project.job_role && <p className="mt-0.5 text-[14px] text-ink-3 break-keep">{project.job_role}</p>}

      <div className="mt-3 flex-1">
        {isDraftOnly ? (
          <div className="space-y-1.5">
            <p className="text-[13px] text-ink-3">{WORKSPACE_COPY.draftCard.summary}</p>
            {draftTotal > 0 && (
              <>
                <div className="h-1.5 rounded-full bg-fill" aria-hidden="true">
                  <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.round((answered / draftTotal) * 100)}%` }} />
                </div>
                <p className="text-[12px] text-ink-4">{WORKSPACE_COPY.progress(answered, draftTotal)}</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* 요약은 자르지 않고 다 보여 준다 */}
            {summary && <p className="text-[14.5px] leading-[1.6] text-ink-2 break-keep">{summary}</p>}
            {keywords.length > 0 && (
              <p className="mt-1.5 text-[12.5px] text-ink-4">{keywords.slice(0, 3).map((kw) => `#${kw}`).join(" ")}</p>
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line-soft pt-3">
        <p className="flex flex-wrap gap-x-1.5 text-[12.5px] text-ink-4">
          <span>{isCompany ? "기업 분석 리포트" : `${questionCount}개 문항`}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(project.created_at, "ymd-dot")} 작성</span>
        </p>
        {kebabItems.length > 0 && (
          <div className="relative z-10 -my-1.5 -mr-2">
            <KebabMenu items={kebabItems} />
          </div>
        )}
      </div>
    </div>
  );
}
