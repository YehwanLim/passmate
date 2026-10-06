import type { ProjectSummary } from "@/types/my";
import KebabMenu, { createDefaultKebabItems } from "./KebabMenu";
import { formatDate } from "@/lib/formatDate";
import { daysUntil } from "@/lib/workspace";
import { WORKSPACE_COPY } from "@/pages/workspaceCopy";

interface ProjectCardProps {
  project: ProjectSummary;
  onViewQuestions: () => void;
  onViewReport: () => void;
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

const BUTTON = "inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-[14px] font-semibold transition-colors";

/** 마이페이지 지원서 목록의 한 줄: 회사·직무 | 마감 | 진행(또는 한줄 요약) | 버튼. lg 미만에서는 위아래로 쌓는다. */
export default function ProjectCard({
  project,
  onViewQuestions,
  onViewReport,
  onDelete,
}: ProjectCardProps) {
  const kebabItems = createDefaultKebabItems({ onDelete });
  const isCompany = project.kind === "COMPANY";
  const keywords = project.keywords ?? [];
  // 상태는 서버가 내려준 최신 analysis 기준으로만 판단한다. 키워드가 비었다고 대기중으로 보지 않는다
  // (구버전 리포트는 키워드 필드가 없을 수 있다).
  const isPending = project.latest_status === "PENDING";
  const isFailed = project.latest_status === "FAILED";
  // "새 지원서"로 만들고 아직 진단받지 않은 지원서: 리포트가 없으니 작성 화면이 주 동작이다.
  const isDraftOnly = !isCompany && !project.latest_analysis_id;
  const summaryFallback = isDraftOnly
    ? WORKSPACE_COPY.draftCard.summary
    : isPending
    ? "아직 분석이 완료되지 않았습니다."
    : isFailed
      ? "분석에 실패했습니다. 다시 시도해 주세요."
      : "한줄 요약이 없는 리포트입니다.";
  const keywordFallback = isPending ? "분석 대기중" : isFailed ? "분석 실패" : null;
  const deadline = deadlineOf(project.deadline);
  const draftTotal = project.draft_question_count ?? 0;
  const answered = project.answered_count ?? 0;
  const questionCount = isDraftOnly ? draftTotal : project.question_count ?? project.analysis_count;

  return (
    <div
      data-testid="application-card"
      className="group relative grid grid-cols-1 gap-3 px-5 py-[18px] lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1.1fr)_288px] lg:items-center lg:gap-5"
    >
      {/* 회사·직무 — 직무는 색 칩 대신 제목 아래 부제로 둔다(긴 직무명도 안 잘림) */}
      <div className="min-w-0 pr-10 lg:pr-0">
        {(project.id === "mock-proj-1" || isCompany) && (
          <p className="mb-0.5 text-[12px] font-semibold text-brand-ink">
            {project.id === "mock-proj-1" ? "샘플" : "기업 분석"}
          </p>
        )}
        <h3 className="truncate text-[17px] font-bold tracking-tight text-ink">
          {project.company_name || project.title || "기업 미지정"}
        </h3>
        {project.job_role && <p className="mt-0.5 truncate text-[14px] text-ink-3">{project.job_role}</p>}
        <p className="mt-1 flex flex-wrap gap-x-1.5 text-[12.5px] text-ink-4">
          <span>{isCompany ? "기업 분석 리포트" : `${questionCount}개 문항`}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(project.created_at, "ymd-dot")} 작성</span>
        </p>
      </div>

      <div className="flex items-center">
        <span className={`inline-flex items-center ${DEADLINE_CLASS[deadline.tone]}`}>{deadline.label}</span>
      </div>

      {/* 진단 전: 몇 문항 썼는지 막대로. 진단 후: 한줄 요약과 키워드. */}
      <div className="min-w-0">
        {isDraftOnly ? (
          <div className="space-y-1.5">
            <p className="text-[13px] text-ink-3">{summaryFallback}</p>
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
            {/* 진단 전 지원서에는 요약이 없으니 "한줄 요약" 이름표는 진단 후에만 단다 */}
            <p className="mb-0.5 text-[11.5px] font-semibold text-ink-4">한줄 요약</p>
            <p className="line-clamp-2 text-[14px] leading-[1.5] text-ink-2 break-keep">
              &ldquo;{project.summary || summaryFallback}&rdquo;
            </p>
            {keywords.length > 0 ? (
              // 키워드는 앞 3개만 — 다 늘어놓으면 줄이 늘어 칸이 커진다
              <p className="mt-1 truncate text-[12px] text-ink-4">
                {keywords.slice(0, 3).map((kw) => `#${kw}`).join(" ")}
              </p>
            ) : keywordFallback ? (
              <p className="mt-1 text-[12px] font-semibold text-ink-4">{keywordFallback}</p>
            ) : null}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 lg:justify-end">
        {isDraftOnly ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onViewQuestions(); }}
            className={`${BUTTON} flex-1 bg-brand-soft text-brand-ink hover:bg-[#dceaff] lg:flex-none`}
          >
            {WORKSPACE_COPY.draftCard.open}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onViewReport(); }}
              className={`${BUTTON} flex-1 bg-ink text-white hover:bg-ink-2 lg:flex-none`}
            >
              리포트 보기
            </button>
            {!isCompany && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onViewQuestions(); }}
                className={`${BUTTON} flex-1 bg-fill text-ink-2 hover:bg-line lg:flex-none`}
              >
                작성한 자소서 보기
              </button>
            )}
          </>
        )}
        {kebabItems.length > 0 && (
          <div className="absolute right-3 top-4 lg:static">
            <KebabMenu items={kebabItems} />
          </div>
        )}
      </div>
    </div>
  );
}
